"use client";

/**
 * TanStack Query hooks for Drive file operations.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/hooks/use-vault";
import {
  listMarkdownFiles,
  getFileContent,
  trashFile,
  renameFile,
  moveFile,
  uploadFile,
  findFileByName,
  uploadWithDuplicateHandling,
} from "@/services/google-drive";
import { DriveFile, DuplicateAction, UploadProgress } from "@/types";
import { useState, useCallback } from "react";

// ─── Query keys ─────────────────────────────────────────────────────────────

export const queryKeys = {
  files: (folderId: string) => ["drive-files", folderId] as const,
  fileContent: (fileId: string) => ["file-content", fileId] as const,
};

// ─── File listing ───────────────────────────────────────────────────────────

export function useDriveFiles() {
  const { accessToken } = useAuth();
  const { currentFolder } = useVault();

  return useQuery({
    queryKey: queryKeys.files(currentFolder?.id ?? ""),
    queryFn: () => {
      if (!accessToken || !currentFolder) return [];
      return listMarkdownFiles(accessToken, currentFolder.id);
    },
    enabled: !!accessToken && !!currentFolder,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Fetch files for any folder (used by accordion subfolders). */
export function useFolderFiles(folderId: string | null) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: queryKeys.files(folderId ?? ""),
    queryFn: () => {
      if (!accessToken || !folderId) return [];
      return listMarkdownFiles(accessToken, folderId);
    },
    enabled: !!accessToken && !!folderId,
    staleTime: 30_000,
  });
}

// ─── File content ───────────────────────────────────────────────────────────

export function useFileContent(fileId: string | null) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: queryKeys.fileContent(fileId ?? ""),
    queryFn: () => {
      if (!accessToken || !fileId) return "";
      return getFileContent(accessToken, fileId);
    },
    enabled: !!accessToken && !!fileId,
    staleTime: 60_000,
  });
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export function useUpload() {
  const { accessToken } = useAuth();
  const { currentFolder } = useVault();
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const updateUpload = useCallback(
    (fileName: string, patch: Partial<UploadProgress>) => {
      setUploads((prev) =>
        prev.map((u) => (u.fileName === fileName ? { ...u, ...patch } : u))
      );
    },
    []
  );

  const checkDuplicate = useCallback(
    async (fileName: string): Promise<DriveFile | null> => {
      if (!accessToken || !currentFolder) return null;
      return findFileByName(accessToken, currentFolder.id, fileName);
    },
    [accessToken, currentFolder]
  );

  const uploadFiles = useCallback(
    async (
      files: File[],
      duplicateActions?: Map<string, { action: DuplicateAction; existingId?: string }>
    ) => {
      if (!accessToken || !currentFolder) return;

      // Initialize upload state
      setUploads(
        files.map((f) => ({
          fileName: f.name,
          status: "validating" as const,
          progress: 0,
        }))
      );

      const results: (DriveFile | null)[] = [];

      for (const file of files) {
        try {
          updateUpload(file.name, { status: "uploading", progress: 0 });

          const dupAction = duplicateActions?.get(file.name);
          let result: DriveFile | null;

          if (dupAction) {
            result = await uploadWithDuplicateHandling(
              accessToken,
              file,
              currentFolder.id,
              dupAction.action,
              dupAction.existingId,
              (pct) => updateUpload(file.name, { progress: pct })
            );
          } else {
            result = await uploadFile(
              accessToken,
              file,
              currentFolder.id,
              (pct) => updateUpload(file.name, { progress: pct })
            );
          }

          results.push(result);
          updateUpload(file.name, { status: "success", progress: 100 });
        } catch (err) {
          updateUpload(file.name, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
          results.push(null);
        }
      }

      // Refresh the files list
      queryClient.invalidateQueries({
        queryKey: queryKeys.files(currentFolder.id),
      });

      // Clear upload state after a short delay
      setTimeout(() => setUploads([]), 3000);

      return results;
    },
    [accessToken, currentFolder, queryClient, updateUpload]
  );

  const clearUploads = useCallback(() => setUploads([]), []);

  return { uploads, uploadFiles, checkDuplicate, clearUploads };
}

/** Upload files to a specific folder (used by accordion folder upload). */
export function useUploadToFolder() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const uploadFilesToFolder = useCallback(
    async (files: File[], folderId: string) => {
      if (!accessToken) return;

      const results: (DriveFile | null)[] = [];

      for (const file of files) {
        try {
          const result = await uploadFile(accessToken, file, folderId);
          results.push(result);
        } catch {
          results.push(null);
        }
      }

      // Refresh that folder's file list
      queryClient.invalidateQueries({
        queryKey: queryKeys.files(folderId),
      });

      return results;
    },
    [accessToken, queryClient]
  );

  return { uploadFilesToFolder };
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export function useDeleteFile() {
  const { accessToken } = useAuth();
  const { currentFolder } = useVault();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      if (!accessToken) throw new Error("Not authenticated");
      return trashFile(accessToken, fileId);
    },
    onSuccess: () => {
      if (currentFolder) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.files(currentFolder.id),
        });
      }
    },
  });
}

// ─── Rename ─────────────────────────────────────────────────────────────────

export function useRenameFile() {
  const { accessToken } = useAuth();
  const { currentFolder } = useVault();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, newName }: { fileId: string; newName: string }) => {
      if (!accessToken) throw new Error("Not authenticated");
      return renameFile(accessToken, fileId, newName);
    },
    onSuccess: () => {
      if (currentFolder) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.files(currentFolder.id),
        });
      }
    },
  });
}

// ─── Move ───────────────────────────────────────────────────────────────────

export function useMoveFile() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      newParentId,
      oldParentId,
    }: {
      fileId: string;
      newParentId: string;
      oldParentId: string;
    }) => {
      if (!accessToken) throw new Error("Not authenticated");
      return moveFile(accessToken, fileId, newParentId, oldParentId);
    },
    onSuccess: (_data, variables) => {
      // Invalidate both source and destination folder queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.files(variables.oldParentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.files(variables.newParentId),
      });
    },
  });
}
