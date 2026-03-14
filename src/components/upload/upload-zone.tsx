"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadFileSchema, ACCEPTED_EXTENSIONS, DuplicateAction } from "@/types";
import { useUpload } from "@/hooks/use-drive-files";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload, FileUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function UploadZone() {
  const { uploads, uploadFiles, checkDuplicate } = useUpload();
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [duplicateFile, setDuplicateFile] = useState<{
    file: File;
    existingId: string;
  } | null>(null);

  const processFiles = useCallback(
    async (acceptedFiles: File[]) => {
      // Validate each file
      const validFiles: File[] = [];
      for (const file of acceptedFiles) {
        const result = uploadFileSchema.safeParse({
          name: file.name,
          size: file.size,
        });
        if (!result.success) {
          toast.error(result.error.issues[0].message);
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) return;

      // Check for duplicates one at a time
      const filesToUpload: File[] = [];
      for (const file of validFiles) {
        const existing = await checkDuplicate(file.name);
        if (existing) {
          setDuplicateFile({ file, existingId: existing.id });
          setPendingFiles(
            validFiles.filter((f) => f.name !== file.name)
          );
          setDuplicateDialogOpen(true);
          return; // Handle one duplicate at a time
        }
        filesToUpload.push(file);
      }

      await uploadFiles(filesToUpload);
      toast.success(
        `Uploaded ${filesToUpload.length} file${filesToUpload.length !== 1 ? "s" : ""}`
      );
    },
    [checkDuplicate, uploadFiles]
  );

  const handleDuplicateAction = useCallback(
    async (action: DuplicateAction) => {
      setDuplicateDialogOpen(false);
      if (!duplicateFile) return;

      const actions = new Map<
        string,
        { action: DuplicateAction; existingId?: string }
      >();
      actions.set(duplicateFile.file.name, {
        action,
        existingId: duplicateFile.existingId,
      });

      const allFiles = [duplicateFile.file, ...pendingFiles];
      await uploadFiles(allFiles, actions);

      if (action !== "cancel") {
        toast.success("Upload complete");
      }

      setDuplicateFile(null);
      setPendingFiles([]);
    },
    [duplicateFile, pendingFiles, uploadFiles]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      processFiles(acceptedFiles);
    },
    [processFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/markdown": [".md", ".markdown"],
      "text/x-markdown": [".md", ".markdown"],
      "text/plain": [".md", ".markdown", ".mdx"],
    },
    multiple: true,
  });

  const isUploading = uploads.some((u) => u.status === "uploading");

  return (
    <>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl transition-all cursor-pointer
          ${
            isDragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-accent/50"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          {isUploading ? (
            <>
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
              <p className="text-sm font-medium">Uploading...</p>
              <div className="mt-3 space-y-1 w-full max-w-xs">
                {uploads.map((u) => (
                  <div key={u.fileName} className="flex items-center gap-2 text-xs">
                    {u.status === "uploading" && (
                      <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                    )}
                    {u.status === "success" && (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    )}
                    {u.status === "error" && (
                      <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                    )}
                    <span className="truncate">{u.fileName}</span>
                    {u.status === "uploading" && (
                      <span className="ml-auto text-muted-foreground">
                        {u.progress}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : isDragActive ? (
            <>
              <FileUp className="h-10 w-10 text-primary mb-3" />
              <p className="text-sm font-medium">Drop your markdown files here</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">
                Drag & drop markdown files here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports {ACCEPTED_EXTENSIONS.join(", ")} (max 10 MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Duplicate handling dialog */}
      <Dialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File already exists</DialogTitle>
            <DialogDescription>
              A file named &ldquo;{duplicateFile?.file.name}&rdquo; already
              exists in this folder. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => handleDuplicateAction("replace")}
              className="w-full cursor-pointer"
            >
              Replace existing file
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDuplicateAction("keep-both")}
              className="w-full cursor-pointer"
            >
              Keep both (auto-rename)
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleDuplicateAction("cancel")}
              className="w-full cursor-pointer"
            >
              Cancel upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
