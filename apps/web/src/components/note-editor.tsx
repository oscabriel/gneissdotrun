import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@cloudflare/kumo";

import { TextAreaField } from "@/components/text-area-field";

interface RewriteProgressUpdate {
   mode: "append" | "replace";
   text: string;
}

interface NoteEditorProps {
   noteId: string;
   title: string;
   initialContent: string;
   onCapture: (
      input: { userInput: string; noteId?: string },
      options?: {
         onRewriteProgress?: (update: RewriteProgressUpdate) => void;
      },
   ) => Promise<void>;
   onSaveNoteContent: (input: { noteId: string; content: string; title?: string }) => Promise<void>;
   onEditorInput: () => void;
   isCapturing: boolean;
   prefillInteraction?: { value: string; nonce: number } | null;
}

type SlashInstructionKind = "none" | "editor" | "agent" | "freeform";

interface SlashInstruction {
   kind: SlashInstructionKind;
   commandName: string | null;
   argument: string;
   raw: string;
}

const WIKI_LINK_PATTERN = /\[\[([^\]]+)\]\]/g;

const EDITOR_FORMATTING_COMMANDS = new Set(["heading", "code", "quote", "bullets"]);
const AGENT_COMMANDS = new Set(["ask", "research", "link", "summarize"]);

function stripSlashCommandLines(input: string): string {
   const lines = input.split("\n");
   const filtered = lines.filter((line) => !/^\s*\/[a-z-]+(?:\s+.*)?\s*$/i.test(line.trim()));
   return filtered.join("\n").trimEnd();
}

function classifySlashInstruction(rawInput: string): SlashInstruction {
   const raw = rawInput.trim();
   if (!raw.startsWith("/")) {
      return {
         kind: "none",
         commandName: null,
         argument: raw,
         raw,
      };
   }

   const match = raw.match(/^\/([a-z-]+)\s*(.*)$/i);
   if (!match) {
      return {
         kind: "freeform",
         commandName: null,
         argument: "",
         raw,
      };
   }

   const commandName = (match[1] ?? "").toLowerCase();
   const argument = (match[2] ?? "").trim();

   if (EDITOR_FORMATTING_COMMANDS.has(commandName)) {
      return {
         kind: "editor",
         commandName,
         argument,
         raw,
      };
   }

   if (AGENT_COMMANDS.has(commandName)) {
      return {
         kind: "agent",
         commandName,
         argument,
         raw,
      };
   }

   return {
      kind: "freeform",
      commandName,
      argument,
      raw,
   };
}

function appendBlock(current: string, block: string): string {
   if (!current.trim()) {
      return block;
   }

   return `${current.trimEnd()}\n\n${block}`;
}

function applyEditorFormatting(current: string, commandName: string, argument: string): string {
   switch (commandName) {
      case "heading": {
         const text = argument || "New heading";
         return appendBlock(current, `# ${text}`);
      }
      case "code": {
         const text = argument || "// Add code";
         return appendBlock(current, `\`\`\`\n${text}\n\`\`\``);
      }
      case "quote": {
         const text = argument || "Quote";
         return appendBlock(current, `> ${text}`);
      }
      case "bullets": {
         const lines = argument
            ? argument
               .split(";")
               .map((line) => line.trim())
               .filter(Boolean)
            : ["List item"];

         return appendBlock(current, lines.map((line) => `- ${line}`).join("\n"));
      }
      default:
         return current;
   }
}

function renderWikiLinkedText(text: string): ReactNode {
   const lines = text.split("\n");

   return lines.map((line, lineIndex) => {
      const parts: ReactNode[] = [];
      let lastIndex = 0;
      WIKI_LINK_PATTERN.lastIndex = 0;

      for (const match of line.matchAll(WIKI_LINK_PATTERN)) {
         const fullMatch = match[0];
         const label = (match[1] ?? "").trim();
         const matchIndex = match.index ?? 0;

         if (matchIndex > lastIndex) {
            parts.push(
               <span key={`text-${lineIndex}-${lastIndex}`}>{line.slice(lastIndex, matchIndex)}</span>,
            );
         }

         if (label.length > 0) {
            parts.push(
               <a
                  key={`wiki-${lineIndex}-${matchIndex}`}
                  href={`/collections?query=${encodeURIComponent(label)}`}
                  className="text-kumo-link underline underline-offset-2"
               >
                  [[{label}]]
               </a>,
            );
         } else {
            parts.push(<span key={`empty-${lineIndex}-${matchIndex}`}>{fullMatch}</span>);
         }

         lastIndex = matchIndex + fullMatch.length;
      }

      if (lastIndex < line.length) {
         parts.push(<span key={`tail-${lineIndex}`}>{line.slice(lastIndex)}</span>);
      }

      if (parts.length === 0) {
         parts.push(<span key={`blank-${lineIndex}`}>&nbsp;</span>);
      }

      return <p key={`line-${lineIndex}`}>{parts}</p>;
   });
}

export function NoteEditor({
   noteId,
   title,
   initialContent,
   onCapture,
   onSaveNoteContent,
   onEditorInput,
   isCapturing,
   prefillInteraction,
}: NoteEditorProps) {
   const [noteContent, setNoteContent] = useState(stripSlashCommandLines(initialContent));
   const [interactionDraft, setInteractionDraft] = useState("");
   const [pendingRemoteUpdate, setPendingRemoteUpdate] = useState<string | null>(null);
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const lastAcknowledgedContentRef = useRef(stripSlashCommandLines(initialContent));
   const noteContentRef = useRef(stripSlashCommandLines(initialContent));
   const interactionInputRef = useRef<HTMLTextAreaElement | null>(null);
   const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
   const [isEditingNote, setIsEditingNote] = useState(false);

   const resizeNoteTextarea = () => {
      const textarea = noteTextareaRef.current;
      if (!textarea) {
         return;
      }

      textarea.style.height = "0px";
      textarea.style.height = `${textarea.scrollHeight}px`;
   };

   useEffect(() => {
      const sanitized = stripSlashCommandLines(initialContent);
      const hasLocalEdits = noteContentRef.current !== lastAcknowledgedContentRef.current;

      if (hasLocalEdits && sanitized !== noteContentRef.current) {
         setPendingRemoteUpdate(sanitized);
         setStatusMessage("A newer rewrite is available. Apply it or dismiss it.");
         return;
      }

      setNoteContent(sanitized);
      noteContentRef.current = sanitized;
      lastAcknowledgedContentRef.current = sanitized;
      setPendingRemoteUpdate(null);
      setStatusMessage(null);
   }, [initialContent, noteId]);

   useEffect(() => {
      setIsEditingNote(false);
   }, [noteId]);

   useEffect(() => {
      if (!isEditingNote) {
         return;
      }

      noteTextareaRef.current?.focus();
   }, [isEditingNote]);

   useLayoutEffect(() => {
      if (!isEditingNote) {
         return;
      }

      resizeNoteTextarea();
   }, [isEditingNote, noteContent]);

   useEffect(() => {
      if (!prefillInteraction?.value) {
         return;
      }

      onEditorInput();
      setInteractionDraft((current) => {
         const separator = current.trim().length > 0 ? "\n" : "";
         return `${current}${separator}${prefillInteraction.value} `;
      });
      interactionInputRef.current?.focus();
   }, [onEditorInput, prefillInteraction?.nonce, prefillInteraction?.value]);

   const applyPendingUpdate = () => {
      if (!pendingRemoteUpdate) {
         return;
      }

      setNoteContent(pendingRemoteUpdate);
      noteContentRef.current = pendingRemoteUpdate;
      lastAcknowledgedContentRef.current = pendingRemoteUpdate;
      setPendingRemoteUpdate(null);
      setStatusMessage("Rewrite applied.");
   };

   const dismissPendingUpdate = () => {
      setPendingRemoteUpdate(null);
      setStatusMessage("Rewrite dismissed. Your current draft is unchanged.");
   };

   const submitInteraction = async () => {
      const trimmed = interactionDraft.trim();
      if (!trimmed) {
         if (noteContentRef.current === lastAcknowledgedContentRef.current) {
            return;
         }

         try {
            await onSaveNoteContent({
               noteId,
               title,
               content: noteContentRef.current,
            });
            lastAcknowledgedContentRef.current = noteContentRef.current;
            setPendingRemoteUpdate(null);
            setStatusMessage("Saved.");
         } catch {
            setStatusMessage("Save failed. Keep editing and try again.");
         }
         return;
      }

      onEditorInput();
      const instruction = classifySlashInstruction(trimmed);

      if (instruction.kind === "editor" && instruction.commandName) {
         const formatted = applyEditorFormatting(
            noteContentRef.current,
            instruction.commandName,
            instruction.argument,
         );
         const sanitized = stripSlashCommandLines(formatted);
         setNoteContent(sanitized);
         noteContentRef.current = sanitized;
         setPendingRemoteUpdate(null);

         try {
            await onSaveNoteContent({
               noteId,
               title,
               content: sanitized,
            });
            lastAcknowledgedContentRef.current = sanitized;
            setStatusMessage(`Applied /${instruction.commandName} and saved.`);
         } catch {
            setStatusMessage(`Applied /${instruction.commandName} locally. Save failed.`);
         }

         setInteractionDraft("");
         return;
      }

      const hasUnsavedNoteEdits = noteContentRef.current !== lastAcknowledgedContentRef.current;
      if (hasUnsavedNoteEdits) {
         try {
            await onSaveNoteContent({
               noteId,
               title,
               content: noteContentRef.current,
            });
            lastAcknowledgedContentRef.current = noteContentRef.current;
            setPendingRemoteUpdate(null);
         } catch {
            setStatusMessage("Save failed. Keep editing and try again.");
            return;
         }
      }

      const baselineContent = noteContentRef.current;
      let streamedContent = "";
      let sawStreamingUpdate = false;

      try {
         await onCapture(
            {
               noteId,
               userInput: instruction.raw,
            },
            {
               onRewriteProgress: (update) => {
                  sawStreamingUpdate = true;
                  streamedContent =
                     update.mode === "replace" ? update.text : `${streamedContent}${update.text}`;
                  const sanitized = stripSlashCommandLines(streamedContent).trim();
                  setNoteContent(sanitized);
                  noteContentRef.current = sanitized;
                  setPendingRemoteUpdate(null);
                  setStatusMessage("Rewriting...");
               },
            },
         );
      } catch {
         if (sawStreamingUpdate) {
            setNoteContent(baselineContent);
            noteContentRef.current = baselineContent;
         }

         setStatusMessage("Save failed. Keep editing and try again.");
         return;
      }

      setInteractionDraft("");
      setStatusMessage("Saved.");
   };

   const interactionHint = useMemo(() => {
      const instruction = classifySlashInstruction(interactionDraft);
      switch (instruction.kind) {
         case "editor":
            return `/${instruction.commandName} formats the note directly and is not saved as text.`;
         case "agent":
            return `/${instruction.commandName} is sent to the agent and does not appear in the note body.`;
         case "freeform":
            return "Unknown slash command will be sent to the agent as a freeform instruction.";
         default:
            return null;
      }
   }, [interactionDraft]);

   return (
      <div className="space-y-4">
         <section className="space-y-2">
            <p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">Note</p>
            <p className="text-kumo-strong font-serif text-lg leading-tight">{title}</p>

            {pendingRemoteUpdate ? (
               <div className="bg-kumo-tint space-y-2 rounded-md px-3 py-2 text-xs">
                  <p className="text-kumo-default">{statusMessage ?? "A rewrite is ready."}</p>
                  <div className="flex flex-wrap gap-2">
                     <Button variant="outline" size="sm" onClick={applyPendingUpdate}>
                        Apply rewrite
                     </Button>
                     <Button variant="ghost" size="sm" onClick={dismissPendingUpdate}>
                        Dismiss rewrite
                     </Button>
                  </div>
               </div>
            ) : statusMessage ? (
               <p className="text-kumo-subtle text-xs">{statusMessage}</p>
            ) : null}

            {isEditingNote ? (
               <TextAreaField
                  label="Note content"
                  tone="document"
                  ref={noteTextareaRef}
                  className="min-h-30 resize-none overflow-hidden"
                  rows={1}
                  value={noteContent}
                  onChange={(event) => {
                     onEditorInput();
                     setNoteContent(event.target.value);
                     noteContentRef.current = event.target.value;
                  }}
                  onBlur={() => {
                     setIsEditingNote(false);
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                     if (event.nativeEvent.isComposing) {
                        return;
                     }

                     if (event.key === "Escape") {
                        event.preventDefault();
                        setIsEditingNote(false);
                     }
                  }}
                  placeholder="Write your note"
               />
            ) : (
               <div
                  className="bg-kumo-base min-h-30 cursor-text rounded-md p-4 font-serif text-[15px] leading-7"
                  onClick={(event) => {
                     if ((event.target as HTMLElement).closest("a")) {
                        return;
                     }
                     onEditorInput();
                     setIsEditingNote(true);
                  }}
               >
                  {noteContent.trim().length > 0
                     ? renderWikiLinkedText(noteContent)
                     : "No note content yet."}
               </div>
            )}
            <p className="text-kumo-subtle text-xs">
               {isEditingNote
                  ? "Editing note. Press Esc or click outside to return to read mode."
                  : "Click the note body to edit. Wiki links like [[Project X]] stay clickable and open collections search."}
            </p>
         </section>

         <section className="space-y-2">
            <p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">
               Interaction
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
               <TextAreaField
                  label="Interaction input"
                  tone="command"
                  ref={interactionInputRef}
                  value={interactionDraft}
                  onChange={(event) => {
                     onEditorInput();
                     setInteractionDraft(event.target.value);
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                     if (event.nativeEvent.isComposing) {
                        return;
                     }
                     if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        void submitInteraction();
                     }
                  }}
                  placeholder="Describe what to change, or use /heading, /code, /ask, /research, /link, /summarize"
               />
               <Button onClick={() => void submitInteraction()} disabled={isCapturing}>
                  {isCapturing ? "Saving..." : "Save"}
               </Button>
            </div>

            <p className="text-kumo-subtle text-xs">Press Cmd+Enter to Save.</p>
            {interactionHint ? <p className="text-kumo-subtle text-xs">{interactionHint}</p> : null}
         </section>
      </div>
   );
}
