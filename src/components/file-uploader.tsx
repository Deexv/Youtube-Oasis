"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  FileVideoIcon,
  XIcon,
  CheckCircleIcon,
  LoaderIcon,
} from "lucide-react";

export type UploadedFile = {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  title: string;
};

type UploadState = "idle" | "uploading" | "done" | "error";

/**
 * Real file upload with drag-and-drop + click-to-browse + live progress bar.
 * Uses XMLHttpRequest to get upload progress events (fetch doesn't support
 * upload progress natively).
 */
export function FileUploader({
  onUploaded,
  onCleared,
  maxFileSizeMb,
}: {
  onUploaded: (file: UploadedFile) => void;
  onCleared: () => void;
  maxFileSizeMb?: number;
}) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const upload = useCallback(
    (file: File) => {
      // Validate size
      const limitMb = maxFileSizeMb || 2048;
      if (file.size > limitMb * 1024 * 1024) {
        toast.error(`File too large. Limit is ${limitMb} MB.`);
        return;
      }

      // Validate type
      const allowedExtensions = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".mpeg", ".ogv"];
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        toast.error(`Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(", ")}`);
        return;
      }

      setState("uploading");
      setProgress(0);
      setFileName(file.name);
      setFileSize(file.size);
      setUploaded(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
        }
      });

      xhr.addEventListener("load", () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            setState("done");
            setProgress(100);
            const up: UploadedFile = {
              filePath: res.filePath,
              fileName: res.fileName,
              fileSize: res.fileSize,
              mimeType: res.mimeType,
              title: res.title || file.name.replace(/\.[^/.]+$/, ""),
            };
            setUploaded(up);
            onUploaded(up);
            toast.success(`Uploaded ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
          } else {
            setState("error");
            toast.error(res.error || `Upload failed (HTTP ${xhr.status})`);
          }
        } catch {
          setState("error");
          toast.error("Upload failed — invalid server response");
        }
      });

      xhr.addEventListener("error", () => {
        setState("error");
        toast.error("Upload failed — network error");
      });

      xhr.addEventListener("abort", () => {
        setState("idle");
        setProgress(0);
        setFileName(null);
        toast.info("Upload cancelled");
      });

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    },
    [maxFileSizeMb, onUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [upload],
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) upload(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [upload],
  );

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
  }, []);

  const clear = useCallback(() => {
    setUploaded(null);
    setFileName(null);
    setProgress(0);
    setState("idle");
    onCleared();
  }, [onCleared]);

  if (uploaded) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
        <CheckCircleIcon className="size-5 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{uploaded.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {(uploaded.fileSize / 1024 / 1024).toFixed(1)} MB · {uploaded.mimeType}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={clear} className="gap-1">
          <XIcon className="size-3.5" />
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Video file</Label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        {state === "uploading" ? (
          <>
            <LoaderIcon className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              Uploading… {progress}% · {(fileSize / 1024 / 1024).toFixed(1)} MB
            </p>
          </>
        ) : state === "error" ? (
          <>
            <XIcon className="size-8 text-destructive" />
            <p className="text-sm font-medium">Upload failed</p>
            <p className="text-xs text-muted-foreground">Click to try again</p>
          </>
        ) : (
          <>
            <UploadCloudIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop video here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              MP4, MOV, WebM, MKV · up to {maxFileSizeMb || 2048} MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi,.mp4,.mov,.webm,.mkv,.avi"
          onChange={handleSelect}
          className="hidden"
          disabled={state === "uploading"}
        />
      </div>
      {state === "uploading" && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress}%</span>
            <button onClick={cancel} className="text-destructive hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}
      {state === "error" && fileName && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
          <FileVideoIcon className="size-4 text-destructive" />
          <span className="truncate">{fileName}</span>
        </div>
      )}
    </div>
  );
}
