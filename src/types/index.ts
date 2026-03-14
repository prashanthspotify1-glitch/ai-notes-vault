import { z } from "zod";

// ─── Google Auth ────────────────────────────────────────────────────────────

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ─── Google Drive ───────────────────────────────────────────────────────────

/** Minimal Drive file metadata we care about */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
}

/** A Drive folder we track */
export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

/** The fields we request from the Drive files.list API */
export const DRIVE_FILE_FIELDS =
  "id, name, mimeType, modifiedTime, createdTime, size, parents, webViewLink";

// ─── Upload ─────────────────────────────────────────────────────────────────

export type UploadStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "success"
  | "error";

export interface UploadProgress {
  fileName: string;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
}

export type DuplicateAction = "replace" | "keep-both" | "cancel";

// ─── Validation ─────────────────────────────────────────────────────────────

export const ACCEPTED_EXTENSIONS = [".md", ".markdown", ".mdx"] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadFileSchema = z.object({
  name: z
    .string()
    .refine(
      (name) => {
        const lower = name.toLowerCase();
        return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
      },
      { message: "Only .md, .markdown, and .mdx files are allowed." }
    ),
  size: z
    .number()
    .max(MAX_FILE_SIZE_BYTES, "File must be under 10 MB."),
});

// ─── View Modes ─────────────────────────────────────────────────────────────

export type ViewMode = "rendered" | "raw";

// ─── Sort ───────────────────────────────────────────────────────────────────

export type SortOrder = "newest" | "oldest" | "name";
