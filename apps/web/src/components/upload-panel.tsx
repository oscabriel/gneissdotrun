import { Button, Input } from "@cloudflare/kumo";
import { env } from "@gneissdotrun/env/web";
import { useState, type ChangeEvent } from "react";
interface UploadPanelProps {
	noteId?: string;
}
interface UploadSummary {
	id: string;
	noteId: string | null;
	filename: string;
	contentType: string;
	sizeBytes: number;
	objectKey: string;
	createdAt: number;
}
interface UploadFeedback {
	tone: "success" | "error";
	message: string;
}
export function UploadPanel({ noteId }: UploadPanelProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploads, setUploads] = useState<UploadSummary[]>([]);
	const [feedback, setFeedback] = useState<UploadFeedback | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const upload = async () => {
		if (!selectedFile) {
			return;
		}
		setFeedback(null);
		setIsUploading(true);
		try {
			const formData = new FormData();
			formData.append("file", selectedFile);
			if (noteId) {
				formData.append("noteId", noteId);
			}
			const response = await fetch(`${env.VITE_SERVER_URL}/api/uploads`, {
				method: "POST",
				credentials: "include",
				body: formData,
			});
			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Upload failed");
			}
			const payload = (await response.json()) as { upload: UploadSummary };
			setUploads((current) => [payload.upload, ...current]);
			setSelectedFile(null);
			setFeedback({
				tone: "success",
				message: noteId
					? `Uploaded ${payload.upload.filename} and linked it to the active note.`
					: `Uploaded ${payload.upload.filename}.`,
			});
		} catch (uploadError) {
			setFeedback({
				tone: "error",
				message: uploadError instanceof Error ? uploadError.message : "Upload failed",
			});
		} finally {
			setIsUploading(false);
		}
	};
	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<p className="text-kumo-subtle text-xs font-medium tracking-[0.2em] uppercase">Uploads</p>
				<p className="text-kumo-subtle text-xs">
					{noteId
						? "Files uploaded here are linked to the active note and saved for future ingestion work."
						: "Select a note to link uploads. Files are saved, but not yet consumed by AI rewrite."}
				</p>
			</div>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					className="w-full"
					type="file"
					aria-label="Upload file"
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						setSelectedFile(event.target.files?.[0] ?? null);
					}}
				/>
				<Button onClick={() => void upload()} disabled={!selectedFile || isUploading}>
					{isUploading ? "Uploading..." : "Upload"}
				</Button>
			</div>
			{feedback ? (
				<p
					aria-live="polite"
					className={
						feedback.tone === "error" ? "text-kumo-danger text-xs" : "text-kumo-subtle text-xs"
					}
				>
					{feedback.message}
				</p>
			) : null}
			<div className="space-y-1">
				{uploads.map((upload) => (
					<div key={upload.id} className="border-kumo-line bg-kumo-base border px-2 py-1 text-xs">
						<div className="text-kumo-default font-medium">{upload.filename}</div>
						<div className="text-kumo-subtle">
							{upload.contentType} - {Math.round(upload.sizeBytes / 1024)} KB
						</div>
					</div>
				))}
				{uploads.length === 0 ? (
					<p className="text-kumo-subtle text-xs">No uploads yet in this workspace.</p>
				) : null}
			</div>
		</div>
	);
}
