# Architecture

This document explains the system architecture of AI Notes Vault in detail.

---

## Overview

AI Notes Vault is a single-page application (SPA) built with Next.js App Router. Despite using Next.js, it runs entirely on the client side - there is no server-side data fetching or API routes. The app communicates directly with Google's APIs from the browser using an OAuth access token.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│                                                         │
│  ┌─────────┐   ┌──────────┐   ┌────────────────────┐   │
│  │  React   │──>│  Hooks   │──>│  Google Drive API   │   │
│  │   UI     │   │ (Query)  │   │  (REST, client-side)│   │
│  └─────────┘   └──────────┘   └────────────────────┘   │
│       │              │                    │              │
│       │              │                    ▼              │
│       │              │         ┌──────────────────┐     │
│       │              │         │  Google Identity  │     │
│       │              │         │  Services (GIS)   │     │
│       │              │         └──────────────────┘     │
│       ▼              ▼                                  │
│  ┌─────────────────────────────────────────────┐       │
│  │              React Context                    │       │
│  │  AuthProvider │ VaultProvider │ ThemeProvider  │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## Layer Architecture

The app follows a strict layered architecture where dependencies only flow downward:

```
UI Components (pages, layout, feature components)
        │
        ▼
Custom Hooks (useAuth, useVault, useDriveFiles, useTheme)
        │
        ▼
Service Layer (google-drive.ts)
        │
        ▼
External APIs (Google Drive API, Google Identity Services)
```

### Rule: UI components never call the Drive API directly

All Google Drive operations go through the service layer (`src/services/google-drive.ts`), which is consumed through custom hooks. This keeps components focused on presentation and makes the Drive logic testable and replaceable.

---

## Component Hierarchy

```
RootLayout (layout.tsx)
  └── Providers (providers.tsx)
        ├── ThemeProvider
        ├── QueryClientProvider (TanStack Query)
        ├── AuthProvider
        └── TooltipProvider
              └── AppShell (app-shell.tsx)
                    ├── [if not authenticated] LandingPage
                    │     └── ThemeToggle
                    └── [if authenticated] VaultProvider
                          └── Dashboard
                                ├── TopBar
                                │     ├── Breadcrumbs
                                │     ├── ThemeToggle
                                │     └── UserMenu (DropdownMenu)
                                ├── Sidebar
                                │     ├── SearchInput
                                │     ├── SortDropdown
                                │     ├── FolderList
                                │     ├── FileList
                                │     ├── RenameDialog
                                │     └── NewFolderDialog
                                └── MainContent
                                      ├── [no file selected] EmptyState + UploadZone
                                      └── [file selected] MarkdownReader
                                            ├── FileHeader (name, date, size)
                                            ├── ViewModeToggle (rendered/raw)
                                            ├── CopyButton
                                            └── RenderedMarkdown / RawView
```

---

## State Management

The app uses React Context for global state and TanStack Query for server state (Drive API data).

### Auth State (`useAuth`)

| Field | Type | Purpose |
|-------|------|---------|
| `user` | `GoogleUser \| null` | Current signed-in user info |
| `accessToken` | `string \| null` | OAuth access token for API calls |
| `isLoading` | `boolean` | Whether auth is initializing |
| `isAuthenticated` | `boolean` | Derived: `!!user && !!accessToken` |

The access token is stored in `sessionStorage` for tab-lifetime persistence. On page load, the saved token is validated against Google's `tokeninfo` endpoint before reuse. If the token is expired or has wrong scopes, it is cleared and the user sees the sign-in page.

### Vault State (`useVault`)

| Field | Type | Purpose |
|-------|------|---------|
| `rootFolder` | `DriveFolder \| null` | The AI_NOTES root folder |
| `currentFolder` | `DriveFolder \| null` | Currently browsed folder |
| `subfolders` | `DriveFolder[]` | Subfolders of current folder |
| `folderPath` | `DriveFolder[]` | Breadcrumb path from root to current |
| `isBootstrapping` | `boolean` | Whether root folder check is in progress |
| `bootstrapError` | `string \| null` | Error during root folder setup |

The VaultProvider is only mounted when the user is authenticated (inside `AppShell`). This avoids Drive API calls without a token.

### Theme State (`useTheme`)

| Field | Type | Purpose |
|-------|------|---------|
| `theme` | `'light' \| 'dark' \| 'system'` | User's preference |
| `resolvedTheme` | `'light' \| 'dark'` | Actual applied theme |

Persisted to `localStorage`. An inline `<script>` in `layout.tsx` reads the stored preference and applies the `.dark` class before React hydrates, preventing flash of wrong theme.

### Server State (TanStack Query)

| Query Key | Data | Stale Time |
|-----------|------|------------|
| `['drive-files', folderId]` | `DriveFile[]` | 30 seconds |
| `['file-content', fileId]` | `string` | 60 seconds |

TanStack Query handles caching, refetching, and loading/error states for all Drive data. After uploads or mutations (delete, rename), the relevant query is invalidated to trigger a refresh.

---

## Data Flow: Upload Example

```
1. User drops file on UploadZone
           │
           ▼
2. react-dropzone fires onDrop callback
           │
           ▼
3. Zod schema validates file name + size
           │
           ▼ (if invalid, toast error + stop)
           ▼
4. useUpload.checkDuplicate() calls findFileByName()
           │
           ▼ (if duplicate found, show dialog)
           ▼
5. useUpload.uploadFiles() calls uploadFile() or uploadWithDuplicateHandling()
           │
           ▼
6. google-drive.ts builds multipart request body
           │
           ▼
7. XMLHttpRequest sends to googleapis.com/upload/drive/v3/files
           │
           ├──> upload.onprogress updates UploadProgress state
           │
           ▼
8. On success, queryClient.invalidateQueries(['drive-files', folderId])
           │
           ▼
9. TanStack Query refetches file list → sidebar updates
```

---

## File Organization Philosophy

- **`services/`**: Pure functions that make API calls. No React, no state, no hooks. Just `async function` → `Promise<T>`.
- **`hooks/`**: React hooks and context providers. Bridge between UI and services.
- **`components/`**: UI only. No direct API calls. Consume hooks for data.
- **`types/`**: All TypeScript interfaces, type aliases, and Zod schemas in one place.
- **`lib/`**: Utilities and constants. No React dependencies.

This separation makes it straightforward to:
- Replace Google Drive with another storage backend (change `services/` only)
- Add unit tests for Drive logic (test `services/` in isolation)
- Refactor UI without touching data fetching logic

---

## Why No API Routes?

This app has no Next.js API routes (`/api/*`). All Google Drive calls happen from the browser. This is a deliberate MVP decision:

**Pros:**
- Simpler architecture (no server to maintain)
- No CORS issues (browser talks directly to Google)
- No server-side secret management needed
- Deployable as a static site if desired

**Cons:**
- Access token is in the browser (less secure than server-side)
- Token expires after ~1 hour (no refresh token without server flow)
- Can't do background processing

For a personal tool, the trade-off is acceptable. A future enhancement could add API routes for server-side token refresh.

---

## Styling Architecture

The app uses Tailwind CSS v4 with shadcn/ui components built on `@base-ui/react` primitives.

### Theme System

shadcn/ui defines CSS custom properties for all colors:

```css
:root {
  --background: oklch(1 0 0);       /* white */
  --foreground: oklch(0.145 0 0);   /* near-black */
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);   /* near-black */
  --foreground: oklch(0.985 0 0);   /* near-white */
  /* ... */
}
```

Tailwind maps these to utility classes via `@theme inline` in `globals.css`. Components use semantic names like `bg-background`, `text-foreground`, `border-border` which automatically adapt to the active theme.

### Typography

Markdown rendering uses `@tailwindcss/typography` with the `prose` class. Dark mode is handled via `dark:prose-invert`. Code blocks use the One Dark theme from react-syntax-highlighter which works well in both light and dark modes.
