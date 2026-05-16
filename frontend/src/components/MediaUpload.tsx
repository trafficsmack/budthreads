"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { X, Upload, Image, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  file: File;
  preview: string;
}

interface MediaUploadProps {
  onChange?: (files: File[]) => void;
  maxFiles?: number;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaUpload({
  onChange,
  maxFiles = 5,
  className,
}: MediaUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.slice(0, maxFiles - files.length).map(
        (file) => ({
          file,
          preview: URL.createObjectURL(file),
        })
      );
      const updated = [...files, ...newFiles].slice(0, maxFiles);
      setFiles(updated);
      onChange?.(updated.map((f) => f.file));
    },
    [files, maxFiles, onChange]
  );

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    URL.revokeObjectURL(files[index].preview);
    setFiles(updated);
    onChange?.(updated.map((f) => f.file));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "video/*": [".mp4", ".mov", ".avi", ".webm"],
    },
    maxFiles: maxFiles - files.length,
    disabled: files.length >= maxFiles,
  });

  const isVideo = (file: File) => file.type.startsWith("video/");

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      {files.length < maxFiles && (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
            isDragActive
              ? "border-gold bg-gold/5 scale-[1.01]"
              : "border-cream-dark hover:border-gold/50 hover:bg-cream-dark/50"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center">
              <Upload className="w-6 h-6 text-navy/50" />
            </div>
            {isDragActive ? (
              <p className="text-gold font-semibold">Drop files here...</p>
            ) : (
              <>
                <div>
                  <p className="font-semibold text-navy">
                    Drag & drop media here
                  </p>
                  <p className="text-sm text-navy/50 mt-0.5">
                    or click to browse
                  </p>
                </div>
                <p className="text-xs text-navy/40">
                  Images & videos · Max {maxFiles} files ·{" "}
                  {files.length}/{maxFiles} added
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((f, index) => (
            <div
              key={index}
              className="relative group rounded-lg overflow-hidden border border-cream-dark bg-cream-dark aspect-square"
            >
              {isVideo(f.file) ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-navy/10">
                  <Film className="w-8 h-8 text-navy/40" />
                  <p className="text-xs text-navy/60 font-medium px-2 text-center truncate max-w-full">
                    {f.file.name}
                  </p>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                <div className="flex items-center gap-1.5">
                  {isVideo(f.file) ? (
                    <Film className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Image className="w-3.5 h-3.5 text-white" />
                  )}
                  <p className="text-white text-xs font-medium truncate max-w-[80px]">
                    {f.file.name}
                  </p>
                </div>
                <p className="text-white/60 text-xs">
                  {formatBytes(f.file.size)}
                </p>
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-light"
                aria-label="Remove file"
              >
                <X className="w-3 h-3 text-white" strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
