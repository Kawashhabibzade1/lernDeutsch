"use client";

import { useState, useRef } from "react";
import { Upload, Image } from "lucide-react";
import { uploadBook } from "@/src/lib/api";

interface Props {
  onUploaded: (book: any) => void;
}

const ACCEPTED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function BookUpload({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = "." + file.name.split(".").pop()!.toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError("Supported formats: PDF, JPG, PNG, WEBP");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const title = file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ");
      const result = await uploadBook(file, title);
      onUploaded(result.book);
    } catch (e: any) {
      setError("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
      className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer ${
        dragging ? "border-brand-400 bg-brand-50" : "border-slate-300 hover:border-brand-300 hover:bg-slate-50"
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="flex flex-col items-center gap-4">
        {uploading ? (
          <>
            <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600">Uploading and processing...</p>
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="p-3 bg-brand-100 rounded-full">
                <Upload size={28} className="text-brand-600" />
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <Image size={28} className="text-emerald-600" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-700">Upload German text</p>
              <p className="text-sm text-slate-500 mt-1">Drag & drop or click — PDF or photo (JPG, PNG, WEBP)</p>
            </div>
            <p className="text-xs text-slate-400">
              Highlight any word or phrase to get explanations and save to your vocabulary
            </p>
          </>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </div>
  );
}
