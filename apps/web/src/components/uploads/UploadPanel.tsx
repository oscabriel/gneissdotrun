import { env } from "@gneissdotrun/env/web";
import { useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

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

export function UploadPanel({ noteId }: UploadPanelProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploads, setUploads] = useState<UploadSummary[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);

	const upload = async () => {
		if (!selectedFile) {
			return;
		}

		setError(null);
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
		} catch (uploadError) {
			setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="border-border bg-card space-y-3 rounded-none border p-3">
			<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Uploads</p>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					type="file"
					onChange={(event) => {
						setSelectedFile(event.target.files?.[0] ?? null);
					}}
				/>
				<Button onClick={() => void upload()} disabled={!selectedFile || isUploading}>
					{isUploading ? "Uploading..." : "Upload"}
				</Button>
			</div>

			{error ? <p className="text-destructive text-xs">{error}</p> : null}

			<div className="space-y-1">
				{uploads.map((upload) => (
					<div
						key={upload.id}
						className="border-border bg-background rounded-none border px-2 py-1 text-xs"
					>
						<div className="font-medium">{upload.filename}</div>
						<div className="text-muted-foreground">
							{upload.contentType} - {Math.round(upload.sizeBytes / 1024)} KB
						</div>
					</div>
				))}
				{uploads.length === 0 ? (
					<p className="text-muted-foreground text-xs">No uploads yet for this note session.</p>
				) : null}
			</div>
		</div>
	);
}
