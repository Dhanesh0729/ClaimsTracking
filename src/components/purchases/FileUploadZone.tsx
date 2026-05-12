import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileBox,
} from "lucide-react";
import { toast } from "sonner";
import { bytesToSize, fileExtFromName } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILES = 5;

export type UploadedFile = {
  storageId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  preview?: string;
};

function FileIcon({ name }: { name: string }) {
  const ext = fileExtFromName(name);
  if (["png", "jpg", "jpeg"].includes(ext))
    return <FileImage className="h-8 w-8 text-pink-500" />;
  if (ext === "pdf") return <FileText className="h-8 w-8 text-red-500" />;
  if (["doc", "docx"].includes(ext))
    return <FileText className="h-8 w-8 text-blue-500" />;
  if (["xls", "xlsx"].includes(ext))
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  if (ext === "csv") return <FileBox className="h-8 w-8 text-gray-500" />;
  return <FileBox className="h-8 w-8 text-muted-foreground" />;
}

export function FileUploadZone({
  files,
  onChange,
}: {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const generateUploadUrl = useMutation(api.purchases.generateUploadUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return `Unsupported file type: ${f.name}`;
    }
    if (f.size > MAX_FILE_SIZE) {
      return `${f.name} is larger than 10MB`;
    }
    return null;
  };

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const error = validate(file);
    if (error) {
      toast.error(error);
      return null;
    }
    const uploadUrl = await generateUploadUrl({});
    const key = `${file.name}-${file.size}-${Date.now()}`;
    setProgress((p) => ({ ...p, [key]: 0 }));

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress((p) => ({ ...p, [key]: pct }));
        }
      };
      xhr.onload = () => {
        setProgress((p) => {
          const c = { ...p };
          delete c[key];
          return c;
        });
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { storageId } = JSON.parse(xhr.responseText);
            const preview = file.type.startsWith("image/")
              ? URL.createObjectURL(file)
              : undefined;
            resolve({
              storageId,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              preview,
            });
          } catch {
            toast.error("Upload response parse error");
            resolve(null);
          }
        } else {
          toast.error(`Upload failed (${xhr.status})`);
          resolve(null);
        }
      };
      xhr.onerror = () => {
        setProgress((p) => {
          const c = { ...p };
          delete c[key];
          return c;
        });
        toast.error(`Network error uploading ${file.name}`);
        resolve(null);
      };
      xhr.send(file);
    });
  };

  const onSelect = async (list: FileList | null) => {
    if (!list) return;
    const toUpload = Array.from(list);
    if (files.length + toUpload.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} files per purchase`);
      return;
    }
    const results = await Promise.all(toUpload.map(uploadFile));
    onChange([...files, ...results.filter(Boolean) as UploadedFile[]]);
  };

  const remove = (idx: number) => {
    const copy = [...files];
    copy.splice(idx, 1);
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded p-6 text-center transition cursor-pointer",
          dragging
            ? "border-amber bg-amber/5"
            : "border-border hover:border-amber/60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onSelect(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-medium">
          Click or drag files to upload
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          PNG, JPG, PDF, DOC, XLS, CSV (max 10MB each, up to {MAX_FILES} files)
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={(e) => onSelect(e.target.files)}
        />
      </div>

      {Object.entries(progress).map(([key, pct]) => (
        <div key={key} className="text-xs">
          <div className="flex justify-between mb-1">
            <span className="truncate">{key.split("-")[0]}</span>
            <span className="font-mono">{pct}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded overflow-hidden">
            <div
              className="h-full bg-amber transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ))}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, idx) => {
            const isImage = ["png", "jpg", "jpeg"].includes(
              fileExtFromName(f.fileName),
            );
            return (
              <div
                key={f.storageId}
                className="flex items-center gap-3 p-2 rounded border bg-card"
              >
                {isImage && f.preview ? (
                  <img
                    src={f.preview}
                    alt={f.fileName}
                    className="h-12 w-12 object-cover rounded"
                  />
                ) : (
                  <FileIcon name={f.fileName} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {f.fileName}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {bytesToSize(f.fileSize)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1 text-muted-foreground hover:text-danger"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
