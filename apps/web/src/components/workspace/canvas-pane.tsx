import { Button } from "@cloudflare/kumo";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { CommandPalette } from "@/components/command-palette";
import { NoteEditor } from "@/components/note-editor";
import { UploadPanel } from "@/components/upload-panel";
import { TextAreaField } from "@/components/text-area-field";
import type { SidebarNote } from "@/components/sidebar/notes-sidebar";

interface CanvasPaneProps {
   selectedNote: SidebarNote | null;
   onCapture: (
      input: { userInput: string; noteId?: string },
      options?: {
         onRewriteProgress?: (update: { mode: "append" | "replace"; text: string }) => void;
      },
   ) => Promise<void>;
   onSaveNoteContent: (input: { noteId: string; content: string; title?: string }) => Promise<void>;
   isCapturing: boolean;
   ephemeralContent: string | null;
   onCanvasInput: () => void;
   blankFocusSignal: number;
}

export function CanvasPane({
   selectedNote,
   onCapture,
   onSaveNoteContent,
   isCapturing,
   ephemeralContent,
   onCanvasInput,
   blankFocusSignal,
}: CanvasPaneProps) {
   const [blankDraft, setBlankDraft] = useState("");
   const [prefillInteraction, setPrefillInteraction] = useState<{
      value: string;
      nonce: number;
   } | null>(null);
   const blankTextareaRef = useRef<HTMLTextAreaElement | null>(null);

   useEffect(() => {
      if (!selectedNote) {
         blankTextareaRef.current?.focus();
      }
   }, [blankFocusSignal, selectedNote]);

   useEffect(() => {
      setPrefillInteraction(null);
   }, [selectedNote?.id]);

   const submitBlankCapture = async () => {
      const trimmed = blankDraft.trim();
      if (!trimmed) {
         return;
      }

      await onCapture({ userInput: trimmed });
      setBlankDraft("");
   };

   const applyPaletteCommand = (command: string) => {
      onCanvasInput();

      if (selectedNote) {
         setPrefillInteraction({
            value: command,
            nonce: Date.now(),
         });
         return;
      }

      setBlankDraft((current) => {
         const separator = current.trim().length > 0 ? "\n" : "";
         return `${current}${separator}${command} `;
      });
      blankTextareaRef.current?.focus();
   };

   return (
      <>
         <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">Canvas</p>
            <p className="text-kumo-subtle text-xs">Use `Cmd+K` for commands</p>
         </div>

         {ephemeralContent ? (
            <div className="bg-kumo-tint mb-4 rounded-md px-3 py-2 text-sm">{ephemeralContent}</div>
         ) : null}

         {selectedNote ? (
            <NoteEditor
               noteId={selectedNote.id}
               title={selectedNote.title}
               initialContent={selectedNote.content}
               onCapture={onCapture}
               onSaveNoteContent={onSaveNoteContent}
               onEditorInput={onCanvasInput}
               isCapturing={isCapturing}
               prefillInteraction={prefillInteraction}
            />
         ) : (
            <div className="space-y-3">
               <TextAreaField
                  label="Blank note draft"
                  tone="canvas"
                  value={blankDraft}
                  ref={blankTextareaRef}
                  onChange={(event) => {
                     onCanvasInput();
                     setBlankDraft(event.target.value);
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                     if (event.nativeEvent.isComposing) {
                        return;
                     }
                     if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        void submitBlankCapture();
                     }
                  }}
                  placeholder="Write a thought, then Save"
               />

               <div className="flex flex-wrap items-center gap-2">
                  <Button
                     variant="primary"
                     onClick={() => void submitBlankCapture()}
                     disabled={isCapturing}
                  >
                     {isCapturing ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" disabled>
                     Cmd+Enter
                  </Button>
               </div>
            </div>
         )}

         <section className="mt-6 space-y-2">
            <p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">
               Optional context
            </p>
            <details className="bg-kumo-elevated rounded-md px-3 py-2">
               <summary className="text-kumo-subtle cursor-pointer text-xs">Attach files</summary>
               <div className="mt-3">
                  <UploadPanel noteId={selectedNote?.id} />
               </div>
            </details>
         </section>
         <CommandPalette onSelectCommand={applyPaletteCommand} />
      </>
   );
}
