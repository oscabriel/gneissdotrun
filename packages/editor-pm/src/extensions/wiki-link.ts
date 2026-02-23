import Link from "@tiptap/extension-link";

export const WikiAwareLinkExtension = Link.extend({
	name: "link",
	addAttributes() {
		const parentAttributes = this.parent?.() ?? {};
		return {
			...parentAttributes,
			"data-wiki-link": {
				default: null,
				parseHTML: (element) => element.getAttribute("data-wiki-link"),
				renderHTML: (attributes) => {
					const target = attributes["data-wiki-link"];
					if (!target) {
						return {};
					}
					return {
						"data-wiki-link": target,
					};
				},
			},
		};
	},
}).configure({
	openOnClick: true,
	autolink: true,
	linkOnPaste: true,
});
