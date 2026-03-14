/**
 * Google Drive Service
 *
 * All Google Drive API interactions are isolated here.
 * UI components should never call these directly – use hooks instead.
 */

import {
  DriveFile,
  DriveFolder,
  DRIVE_FILE_FIELDS,
  DuplicateAction,
} from "@/types";
import {
  DRIVE_FOLDER_MIME,
  ROOT_FOLDER_NAME,
  isMarkdownFile,
} from "@/lib/constants";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

// ─── Helpers ────────────────────────────────────────────────────────────────

function headers(token: string, extra?: Record<string, string>) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function driveGet<T>(
  token: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${DRIVE_API}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { headers: headers(token) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Folder Operations ─────────────────────────────────────────────────────

/** Find a folder by name under a given parent (or root). */
export async function findFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveFolder | null> {
  const parentClause = parentId
    ? `'${parentId}' in parents and `
    : "";
  const q = `${parentClause}mimeType='${DRIVE_FOLDER_MIME}' and name='${name}' and trashed=false`;
  const data = await driveGet<{ files: DriveFolder[] }>(token, "/files", {
    q,
    fields: "files(id, name, parents)",
    pageSize: "1",
  });
  return data.files[0] ?? null;
}

/** Create a folder in Drive, optionally under a parent. */
export async function createFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveFolder> {
  const body: Record<string, unknown> = {
    name,
    mimeType: DRIVE_FOLDER_MIME,
  };
  if (parentId) body.parents = [parentId];

  const res = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create folder: ${await res.text()}`);
  return res.json();
}

/** Ensure the AI_NOTES root folder exists, return its id. */
export async function ensureRootFolder(token: string): Promise<DriveFolder> {
  const existing = await findFolder(token, ROOT_FOLDER_NAME);
  if (existing) return existing;
  return createFolder(token, ROOT_FOLDER_NAME);
}

/** Create a subfolder inside a parent. */
export async function createSubfolder(
  token: string,
  name: string,
  parentId: string
): Promise<DriveFolder> {
  return createFolder(token, name, parentId);
}

/** List subfolders inside a given folder. */
export async function listSubfolders(
  token: string,
  parentId: string
): Promise<DriveFolder[]> {
  const q = `'${parentId}' in parents and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`;
  const data = await driveGet<{ files: DriveFolder[] }>(token, "/files", {
    q,
    fields: "files(id, name, parents)",
    orderBy: "name",
    pageSize: "100",
  });
  return data.files;
}

// ─── File Operations ────────────────────────────────────────────────────────

/** List markdown files in a given folder. */
export async function listMarkdownFiles(
  token: string,
  folderId: string
): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const data = await driveGet<{ files: DriveFile[] }>(token, "/files", {
    q,
    fields: `files(${DRIVE_FILE_FIELDS})`,
    orderBy: "modifiedTime desc",
    pageSize: "200",
  });
  // Client-side filter: only markdown-named files
  return data.files.filter((f) => isMarkdownFile(f.name));
}

/** Find a file by name in a folder (for duplicate detection). */
export async function findFileByName(
  token: string,
  folderId: string,
  name: string
): Promise<DriveFile | null> {
  const q = `'${folderId}' in parents and name='${name}' and trashed=false`;
  const data = await driveGet<{ files: DriveFile[] }>(token, "/files", {
    q,
    fields: `files(${DRIVE_FILE_FIELDS})`,
    pageSize: "1",
  });
  return data.files[0] ?? null;
}

/** Upload a file to a specific folder using multipart upload. */
export async function uploadFile(
  token: string,
  file: File,
  folderId: string,
  onProgress?: (pct: number) => void
): Promise<DriveFile> {
  const metadata = {
    name: file.name,
    parents: [folderId],
    mimeType: "text/markdown",
  };

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const boundary = "-----vault_boundary_" + Date.now();
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";

    const reader = new FileReader();
    reader.onload = () => {
      const metaPart =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata);
      const mediaPart =
        delimiter +
        `Content-Type: text/markdown\r\n\r\n` +
        (reader.result as string);
      const body = metaPart + mediaPart + closeDelimiter;

      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `${UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent(DRIVE_FILE_FIELDS)}`
      );
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader(
        "Content-Type",
        `multipart/related; boundary="${boundary}"`
      );

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload network error"));
      xhr.send(body);
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/** Replace an existing file's content (update). */
export async function updateFileContent(
  token: string,
  fileId: string,
  file: File
): Promise<DriveFile> {
  const res = await fetch(
    `${UPLOAD_API}/files/${fileId}?uploadType=media&fields=${encodeURIComponent(DRIVE_FILE_FIELDS)}`,
    {
      method: "PATCH",
      headers: headers(token, { "Content-Type": "text/markdown" }),
      body: file,
    }
  );
  if (!res.ok)
    throw new Error(`Update failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Handle a duplicate: replace, keep-both (auto-rename), or cancel. */
export async function uploadWithDuplicateHandling(
  token: string,
  file: File,
  folderId: string,
  action: DuplicateAction,
  existingFileId?: string,
  onProgress?: (pct: number) => void
): Promise<DriveFile | null> {
  switch (action) {
    case "replace":
      if (!existingFileId) throw new Error("No existing file id to replace");
      return updateFileContent(token, existingFileId, file);
    case "keep-both": {
      const ext = file.name.substring(file.name.lastIndexOf("."));
      const base = file.name.substring(0, file.name.lastIndexOf("."));
      const newName = `${base}_${Date.now()}${ext}`;
      const renamed = new File([file], newName, { type: file.type });
      return uploadFile(token, renamed, folderId, onProgress);
    }
    case "cancel":
      return null;
  }
}

/** Get a file's content as text. */
export async function getFileContent(
  token: string,
  fileId: string
): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: headers(token),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch file (${res.status}): ${await res.text()}`);
  return res.text();
}

/** Delete a file (move to trash). */
export async function trashFile(
  token: string,
  fileId: string
): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "PATCH",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok)
    throw new Error(`Failed to trash file: ${await res.text()}`);
}

/** Rename a file. */
export async function renameFile(
  token: string,
  fileId: string,
  newName: string
): Promise<DriveFile> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "PATCH",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok)
    throw new Error(`Failed to rename file: ${await res.text()}`);
  return res.json();
}

/** Move a file from one parent folder to another. */
export async function moveFile(
  token: string,
  fileId: string,
  newParentId: string,
  oldParentId: string
): Promise<DriveFile> {
  const url = new URL(`${DRIVE_API}/files/${fileId}`);
  url.searchParams.set("addParents", newParentId);
  url.searchParams.set("removeParents", oldParentId);
  url.searchParams.set("fields", DRIVE_FILE_FIELDS);

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  if (!res.ok)
    throw new Error(`Failed to move file: ${await res.text()}`);
  return res.json();
}
