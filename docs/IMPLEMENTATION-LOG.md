# Implementation Log

This document records every step taken to build AI Notes Vault, in chronological order. It explains what was done, why, and what problems were encountered along the way.

---

## Phase 1: Project Initialization

### Step 1: Create the Next.js Project

```bash
npx create-next-app@latest ai-notes-vault \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack
```

**Why these choices:**
- `--typescript`: Type safety throughout the codebase
- `--tailwind`: Required for shadcn/ui and the design system
- `--app`: App Router (the modern Next.js paradigm)
- `--src-dir`: Keeps source code separate from config files
- `--import-alias "@/*"`: Clean imports like `@/components/...` instead of relative paths

This generated a Next.js 16 project with Tailwind CSS v4.

### Step 2: Install Dependencies

```bash
# Core UI and functionality
npm install react-markdown remark-gfm rehype-highlight rehype-raw \
  react-dropzone zod @tanstack/react-query lucide-react \
  class-variance-authority clsx tailwind-merge \
  react-syntax-highlighter sonner

# Type definitions
npm install -D @types/react-syntax-highlighter

# Tailwind typography plugin for prose styles
npm install @tailwindcss/typography
```

**Package choices explained:**
- `react-markdown` + `remark-gfm`: Markdown rendering with GitHub Flavored Markdown (tables, strikethrough, etc.)
- `react-syntax-highlighter`: Code block syntax highlighting with many language/theme options
- `react-dropzone`: Battle-tested drag-and-drop file upload library
- `zod`: Runtime validation for file uploads (name, size, type)
- `@tanstack/react-query`: Server state management with caching, so Drive API data stays fresh
- `lucide-react`: Clean, consistent icon set
- `sonner`: Toast notifications (the one shadcn/ui recommends)
- `@tailwindcss/typography`: The `prose` class for beautifully styled markdown content

### Step 3: Initialize shadcn/ui

```bash
npx shadcn@latest init -d
```

This set up shadcn/ui v4, which uses `@base-ui/react` primitives (not Radix UI as in earlier versions). This was an important discovery - the newer shadcn/ui doesn't support the `asChild` prop pattern. It uses a `render` prop instead.

Then added the specific components needed:

```bash
npx shadcn@latest add dialog dropdown-menu input scroll-area \
  separator sheet skeleton tooltip avatar badge sonner
```

---

## Phase 2: Project Structure

Created the directory structure:

```bash
mkdir -p src/{services,types,hooks,components/{layout,vault,upload,markdown}}
```

**Philosophy:** Keep concerns separated:
- `services/` for API logic (no React)
- `hooks/` for React state + data fetching
- `components/` for UI only
- `types/` for shared TypeScript definitions

---

## Phase 3: Types and Constants

### `src/types/index.ts`

Defined all TypeScript interfaces in one file:
- `GoogleUser`, `AuthState` - auth types
- `DriveFile`, `DriveFolder` - Drive API response types
- `UploadProgress`, `DuplicateAction` - upload flow types
- `ViewMode`, `SortOrder` - UI state types
- Zod schemas for file validation (`uploadFileSchema`)

### `src/lib/constants.ts`

Centralized all magic strings:
- `APP_NAME`, `ROOT_FOLDER_NAME` ("AI_NOTES")
- `GOOGLE_SCOPES` - OAuth scopes
- `DRIVE_FOLDER_MIME` - the MIME type for Drive folders
- `MARKDOWN_EXTENSIONS` - accepted file extensions
- `isMarkdownFile()` - filename filter function

### `src/lib/env.ts`

A single function `getGoogleClientId()` that reads the env var and throws a helpful error if missing. This gives a clear error message instead of a cryptic `undefined` somewhere deep in the Google SDK.

---

## Phase 4: Google Drive Service Layer

### `src/services/google-drive.ts`

This is the most critical file. All Google Drive API calls are isolated here.

**Functions implemented:**
- `findFolder()` / `createFolder()` / `ensureRootFolder()` - folder management
- `listSubfolders()` - subfolder navigation
- `listMarkdownFiles()` - list + client-side filter by extension
- `findFileByName()` - duplicate detection before upload
- `uploadFile()` - multipart upload with progress tracking
- `updateFileContent()` - replace an existing file's content
- `uploadWithDuplicateHandling()` - orchestrates replace/keep-both/cancel
- `getFileContent()` - download file as text for reading
- `trashFile()` / `renameFile()` - file management

**Key decision: Using XMLHttpRequest for uploads**

The `fetch` API doesn't support upload progress events. To show a progress bar during uploads, we use `XMLHttpRequest` with `xhr.upload.onprogress`. This is the one place where XHR is still superior to fetch.

**Key decision: Client-side markdown filtering**

Google Drive's API can filter by MIME type but not by file extension. Since Drive assigns varying MIME types to markdown files (`text/markdown`, `text/plain`, `application/octet-stream`), we can't reliably filter server-side. Instead, we fetch all non-trashed files in the folder and filter by extension in JavaScript.

---

## Phase 5: Authentication

### `src/hooks/use-auth.tsx`

Implements Google Identity Services (GIS) OAuth 2.0 implicit flow.

**How it works:**
1. Dynamically loads the GIS script (`accounts.google.com/gsi/client`)
2. Creates a `TokenClient` with the app's Client ID and requested scopes
3. On sign-in, opens Google's consent popup
4. On success, stores the access token in `sessionStorage`
5. Fetches user info from Google's userinfo endpoint

**Problem encountered: Stale tokens with wrong scopes**

When we changed from `drive.file` to `drive` scope, users who had already signed in still had tokens with the old scope in `sessionStorage`. The app would restore the old token, auth would "succeed" (user info fetches fine with any token), but Drive API calls would fail with 403.

**Fix:** Added token validation via Google's `tokeninfo` endpoint:

```
GET https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=TOKEN
```

This returns the actual scopes on the token. If `drive` isn't present, we clear the stored token and force re-authentication.

---

## Phase 6: Vault State Management

### `src/hooks/use-vault.tsx`

Manages the "vault" concept - the folder structure inside Google Drive.

**Bootstrap flow:**
1. On mount (after auth), call `ensureRootFolder()`
2. Search Drive for a folder named "AI_NOTES"
3. If found, use it. If not, create it.
4. Store the folder as `rootFolder` and `currentFolder`

**Navigation:**
- `folderPath` is a breadcrumb array: `[AI_NOTES, subfolder1, subfolder2]`
- `navigateToFolder()` pushes to the path
- `navigateToPathIndex()` pops back to a specific point in the path

**Why a separate context from auth?**

The vault depends on auth (needs a token), but auth doesn't depend on the vault. By separating them, the `VaultProvider` is only mounted when the user is authenticated, avoiding unnecessary Drive API calls.

---

## Phase 7: Data Fetching Hooks

### `src/hooks/use-drive-files.ts`

TanStack Query hooks wrapping the service layer:

- `useDriveFiles()` - lists files in current folder (30s stale time)
- `useFileContent(fileId)` - fetches file content (60s stale time)
- `useUpload()` - manages upload state, duplicate checks, progress tracking
- `useDeleteFile()` - mutation that trashes a file then invalidates the list
- `useRenameFile()` - mutation that renames then invalidates

**Why TanStack Query?**

Without it, we'd need manual loading/error states, caching, refetch-on-focus, and cache invalidation for every data operation. TanStack Query handles all of this declaratively.

---

## Phase 8: UI Components

### Landing Page (`landing-page.tsx`)

Shows when not authenticated. Features:
- App branding (Vault icon + name)
- Three feature cards (Drag & Drop, Read & Browse, Your Drive)
- Sign in button
- Theme toggle in header

### Top Bar (`top-bar.tsx`)

Always visible when authenticated:
- App title with Vault icon
- Breadcrumb navigation for folder path
- Current folder badge
- Theme toggle
- User avatar with dropdown menu (sign out)

### Sidebar (`sidebar.tsx`)

The file browser. This is the most complex component:
- Search input (filters by filename client-side)
- Sort dropdown (newest/oldest/name)
- New folder button + dialog
- Refresh button
- Back navigation when in subfolder
- Subfolder list (click to navigate)
- File list with:
  - File icon (highlighted when selected)
  - Filename (truncated)
  - Modified date (relative: "Just now", "3h ago", "Yesterday", "Mar 14")
  - File size badge
  - Actions menu (rename, delete) on hover
- Rename dialog
- File count footer
- Empty state when no files
- Loading skeleton state

### Upload Zone (`upload-zone.tsx`)

Drag-and-drop area powered by react-dropzone:
- Accepts `.md`, `.markdown`, `.mdx` files
- Visual states: idle, drag active, uploading, success
- Zod validation for each file
- Duplicate detection with dialog (replace / keep-both / cancel)
- Per-file progress indicators during upload

### Markdown Reader (`markdown-reader.tsx`)

The main content area when a file is selected:
- File header: name, modified date, size, Drive link
- View mode toggle: Rendered / Raw
- Copy to clipboard button
- Rendered view: react-markdown + remark-gfm + syntax highlighting
- Raw view: monospace pre block with whitespace preserved
- Loading skeleton
- Error state

### Dashboard (`dashboard.tsx`)

Composes everything together:
- TopBar (fixed)
- Sidebar (left, fixed width)
- Main content area (flex-1)
- When no file selected: empty state + centered upload zone
- When file selected: MarkdownReader + floating upload FAB

### App Shell (`app-shell.tsx`)

The auth gate:
- Loading: shows vault icon + spinner
- Not authenticated: shows LandingPage
- Authenticated: wraps Dashboard in VaultProvider

---

## Phase 9: Dark Mode

### Problem: shadcn/ui already had dark theme CSS variables

The `globals.css` file generated by shadcn/ui already contained a `.dark { }` block with all dark theme variables. The only missing piece was toggling the `.dark` class on `<html>`.

### Implementation

1. **`src/hooks/use-theme.tsx`**: Context provider managing light/dark/system preference
   - Reads/writes `localStorage` for persistence
   - Listens for `prefers-color-scheme` media query changes (for "system" mode)
   - Applies `.dark` class to `document.documentElement`

2. **`src/components/layout/theme-toggle.tsx`**: Dropdown with Sun/Moon/Monitor icons

3. **Flash prevention**: An inline `<script>` in `layout.tsx` runs before React hydrates:
   ```javascript
   var stored = localStorage.getItem('ai-notes-vault-theme');
   var theme = stored || 'system';
   // resolve system preference, add class to <html>
   ```
   This prevents the page from briefly showing the wrong theme.

---

## Phase 10: Scope Change (drive.file → drive)

### The Problem

With `drive.file` scope, the `files.list` API call returned 403:

```
"Request had insufficient authentication scopes"
"method": "google.apps.drive.v3.DriveFiles.List"
```

### Root Cause

Google's `drive.file` scope doesn't allow `'folderId' in parents` queries. Even though the folder was created by the app (which `drive.file` should allow access to), the **list operation itself** requires broader scope.

### The Fix

1. Changed `GOOGLE_SCOPES` from `drive.file` to `drive`
2. Updated the OAuth consent screen in Google Cloud to include `drive` scope
3. Added token scope validation so old `drive.file` tokens are rejected
4. Added `signIn()` to clear sessionStorage before requesting new token
5. Updated README and docs to explain the trade-off

### Lesson Learned

Google's scope documentation is ambiguous about what operations each scope allows. `drive.file` sounds like it should work for "files the app created", but it has limitations that aren't obvious until you hit specific API patterns. Always test the actual API calls with your chosen scope early in development.

---

## Problems Encountered and Solutions

### 1. shadcn/ui v4 uses `@base-ui/react`, not Radix

**Problem:** All online shadcn/ui examples use `asChild` prop, but v4 uses `render` prop instead.

**Solution:** Changed all `<DropdownMenuTrigger asChild>` to `<DropdownMenuTrigger render={<button ... />}>`. Replaced `<Button asChild>` wrapping `<a>` tags with plain `<a>` elements styled with Tailwind classes.

### 2. Zod v4 API change

**Problem:** Zod 4 uses `.issues` instead of `.errors` on `ZodError`.

**Solution:** Changed `result.error.errors[0].message` to `result.error.issues[0].message`.

### 3. Token persistence across scope changes

**Problem:** After changing OAuth scope, old tokens with wrong scope were restored from sessionStorage, causing 403 errors.

**Solution:** Added `verifyTokenScopes()` that calls Google's `tokeninfo` endpoint before accepting a stored token. If scope verification fails, the token is cleared.

### 4. Dark mode flash of unstyled content (FOUC)

**Problem:** React hydration happens after the page renders, so the dark theme class was applied late, causing a brief white flash.

**Solution:** Added an inline `<script>` in the HTML `<head>` that reads the theme from `localStorage` and applies the `.dark` class before any rendering occurs.

---

## What I Would Do Differently

If starting over, I would:

1. **Test `drive.file` scope immediately** before building any Drive integration
2. **Start with dark mode** instead of adding it later (it was trivial since shadcn/ui already had the CSS)
3. **Use Next.js API routes** for token refresh if building for more than personal use
4. **Pin shadcn/ui version** to avoid surprises with the Radix → base-ui migration
