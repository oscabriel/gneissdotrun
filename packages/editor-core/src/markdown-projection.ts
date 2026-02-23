export type ProjectionInlineSegment =
	| {
			kind: "text";
			value: string;
	  }
	| {
			kind: "strong";
			value: string;
	  }
	| {
			kind: "emphasis";
			value: string;
	  }
	| {
			kind: "inline-code";
			value: string;
	  }
	| {
			kind: "wiki-link";
			value: string;
	  }
	| {
			kind: "link";
			label: string;
			url: string;
	  };

export type ProjectionLine =
	| {
			kind: "blank";
	  }
	| {
			kind: "fence";
			raw: string;
	  }
	| {
			kind: "code";
			value: string;
	  }
	| {
			kind: "heading";
			level: 1 | 2 | 3 | 4 | 5 | 6;
			prefix: string;
			spacing: string;
			content: ProjectionInlineSegment[];
	  }
	| {
			kind: "task";
			prefix: string;
			content: ProjectionInlineSegment[];
	  }
	| {
			kind: "unordered";
			prefix: string;
			content: ProjectionInlineSegment[];
	  }
	| {
			kind: "ordered";
			prefix: string;
			content: ProjectionInlineSegment[];
	  }
	| {
			kind: "quote";
			prefix: string;
			content: ProjectionInlineSegment[];
	  }
	| {
			kind: "paragraph";
			content: ProjectionInlineSegment[];
	  };

export interface ProjectionDocument {
	lines: ProjectionLine[];
}

export function parseInlineMarkdown(input: string): ProjectionInlineSegment[] {
	const segments: ProjectionInlineSegment[] = [];
	let cursor = 0;
	let plainBuffer = "";

	const flushPlainBuffer = () => {
		if (!plainBuffer) {
			return;
		}

		segments.push({
			kind: "text",
			value: plainBuffer,
		});
		plainBuffer = "";
	};

	while (cursor < input.length) {
		if (input.startsWith("**", cursor)) {
			const end = input.indexOf("**", cursor + 2);
			if (end > cursor + 2) {
				flushPlainBuffer();
				segments.push({
					kind: "strong",
					value: input.slice(cursor + 2, end),
				});
				cursor = end + 2;
				continue;
			}
		}

		if (input[cursor] === "*" && !input.startsWith("**", cursor)) {
			const end = input.indexOf("*", cursor + 1);
			if (end > cursor + 1) {
				flushPlainBuffer();
				segments.push({
					kind: "emphasis",
					value: input.slice(cursor + 1, end),
				});
				cursor = end + 1;
				continue;
			}
		}

		if (input[cursor] === "`") {
			const end = input.indexOf("`", cursor + 1);
			if (end > cursor + 1) {
				flushPlainBuffer();
				segments.push({
					kind: "inline-code",
					value: input.slice(cursor + 1, end),
				});
				cursor = end + 1;
				continue;
			}
		}

		if (input.startsWith("[[", cursor)) {
			const end = input.indexOf("]]", cursor + 2);
			if (end > cursor + 2) {
				flushPlainBuffer();
				segments.push({
					kind: "wiki-link",
					value: input.slice(cursor + 2, end),
				});
				cursor = end + 2;
				continue;
			}
		}

		if (input[cursor] === "[") {
			const labelEnd = input.indexOf("](", cursor + 1);
			if (labelEnd > cursor + 1) {
				const urlEnd = input.indexOf(")", labelEnd + 2);
				if (urlEnd > labelEnd + 2) {
					flushPlainBuffer();
					segments.push({
						kind: "link",
						label: input.slice(cursor + 1, labelEnd),
						url: input.slice(labelEnd + 2, urlEnd),
					});
					cursor = urlEnd + 1;
					continue;
				}
			}
		}

		plainBuffer += input[cursor];
		cursor += 1;
	}

	flushPlainBuffer();
	return segments;
}

export function serializeInlineMarkdown(segments: ProjectionInlineSegment[]): string {
	let output = "";

	for (const segment of segments) {
		switch (segment.kind) {
			case "text":
				output += segment.value;
				break;
			case "strong":
				output += `**${segment.value}**`;
				break;
			case "emphasis":
				output += `*${segment.value}*`;
				break;
			case "inline-code":
				output += `\`${segment.value}\``;
				break;
			case "wiki-link":
				output += `[[${segment.value}]]`;
				break;
			case "link":
				output += `[${segment.label}](${segment.url})`;
				break;
		}
	}

	return output;
}

function parseLine(line: string, isCodeBlock: boolean): ProjectionLine {
	if (line.length === 0) {
		return { kind: "blank" };
	}

	if (line.trimStart().startsWith("```")) {
		return {
			kind: "fence",
			raw: line,
		};
	}

	if (isCodeBlock) {
		return {
			kind: "code",
			value: line,
		};
	}

	const headingMatch = line.match(/^(#{1,6})(\s+)(.*)$/);
	if (headingMatch) {
		const [, prefix = "", spacing = "", content = ""] = headingMatch;
		const level = Math.min(prefix.length, 6) as 1 | 2 | 3 | 4 | 5 | 6;
		return {
			kind: "heading",
			level,
			prefix,
			spacing,
			content: parseInlineMarkdown(content),
		};
	}

	const taskMatch = line.match(/^(\s*[-*+]\s\[(?: |x|X)\]\s)(.*)$/);
	if (taskMatch) {
		const [, prefix = "", content = ""] = taskMatch;
		return {
			kind: "task",
			prefix,
			content: parseInlineMarkdown(content),
		};
	}

	const unorderedMatch = line.match(/^(\s*[-*+]\s)(.*)$/);
	if (unorderedMatch) {
		const [, prefix = "", content = ""] = unorderedMatch;
		return {
			kind: "unordered",
			prefix,
			content: parseInlineMarkdown(content),
		};
	}

	const orderedMatch = line.match(/^(\s*\d+\.\s)(.*)$/);
	if (orderedMatch) {
		const [, prefix = "", content = ""] = orderedMatch;
		return {
			kind: "ordered",
			prefix,
			content: parseInlineMarkdown(content),
		};
	}

	const quoteMatch = line.match(/^(\s*>\s?)(.*)$/);
	if (quoteMatch) {
		const [, prefix = "", content = ""] = quoteMatch;
		return {
			kind: "quote",
			prefix,
			content: parseInlineMarkdown(content),
		};
	}

	return {
		kind: "paragraph",
		content: parseInlineMarkdown(line),
	};
}

export function parseProjectionMarkdown(markdown: string): ProjectionDocument {
	const lines = markdown.split("\n");
	const projection: ProjectionLine[] = [];
	let inCodeBlock = false;

	for (const line of lines) {
		projection.push(parseLine(line, inCodeBlock));

		if (line.trimStart().startsWith("```")) {
			inCodeBlock = !inCodeBlock;
		}
	}

	return {
		lines: projection,
	};
}

function serializeLine(line: ProjectionLine): string {
	switch (line.kind) {
		case "blank":
			return "";
		case "fence":
			return line.raw;
		case "code":
			return line.value;
		case "heading":
			return `${line.prefix}${line.spacing}${serializeInlineMarkdown(line.content)}`;
		case "task":
			return `${line.prefix}${serializeInlineMarkdown(line.content)}`;
		case "unordered":
			return `${line.prefix}${serializeInlineMarkdown(line.content)}`;
		case "ordered":
			return `${line.prefix}${serializeInlineMarkdown(line.content)}`;
		case "quote":
			return `${line.prefix}${serializeInlineMarkdown(line.content)}`;
		case "paragraph":
			return serializeInlineMarkdown(line.content);
	}
}

export function serializeProjectionMarkdown(projection: ProjectionDocument): string {
	return projection.lines.map((line) => serializeLine(line)).join("\n");
}
