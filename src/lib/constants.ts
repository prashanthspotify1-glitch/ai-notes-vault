/** App-wide constants */

export const APP_NAME = "AI Notes Vault";

/** The root Google Drive folder the app operates on */
export const ROOT_FOLDER_NAME = "AI_NOTES";

/**
 * Google OAuth scopes.
 *
 * We use `drive` instead of `drive.file` because `drive.file` only grants
 * access to files created or opened by the app. While the app creates the
 * AI_NOTES folder and uploads files into it, the `drive.file` scope does
 * not reliably support the `'folderId' in parents` list query needed to
 * browse folder contents. Google treats that as a broad list operation
 * requiring the full `drive` or `drive.readonly` scope.
 *
 * Since this is a personal app and the UI enforces markdown-only browsing
 * within the AI_NOTES folder, using `drive` is the pragmatic choice.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

/** Mime type for a Google Drive folder */
export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

/** Markdown-related mime types we look for */
export const MARKDOWN_MIME_TYPES = [
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "application/octet-stream",
] as const;

/** Extensions we filter on (client-side supplement to mime filtering) */
export const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdx"] as const;

export const isMarkdownFile = (name: string): boolean => {
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
};
