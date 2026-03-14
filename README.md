# AI Notes Vault

A personal web app for archiving and reading markdown files generated during AI-assisted coding workflows. Drop `.md` files in, they get stored in your Google Drive. Browse and read them later with beautiful markdown rendering.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Google Cloud Setup (Step by Step)](#google-cloud-setup-step-by-step)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Dark Mode](#dark-mode)
- [File Types](#file-types)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [What This App Does NOT Do](#what-this-app-does-not-do)

---

## Features

- **Google Sign-In** via Google Identity Services (OAuth 2.0 implicit flow)
- **Google Drive integration** as the storage backend
- **Dedicated `AI_NOTES` folder** auto-created in your Drive on first use
- **Drag & drop upload** for `.md`, `.markdown`, `.mdx` files
- **Duplicate detection** with replace / keep-both / cancel options
- **File browser** with search, sort (newest/oldest/name), subfolder navigation
- **Markdown reader** with rendered and raw view modes
- **Syntax highlighting** for code blocks (via Prism)
- **GFM support** (tables, strikethrough, task lists, autolinks)
- **Subfolder management** (create, navigate, breadcrumbs)
- **File operations** (rename, delete)
- **Copy to clipboard** for raw markdown content
- **Dark mode** with light/dark/system preference and localStorage persistence
- **Toast notifications** for all operations
- **Polished empty/loading/error states** throughout

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (base-ui primitives) |
| Auth | Google Identity Services (GIS) |
| Storage | Google Drive API v3 |
| Markdown | react-markdown + remark-gfm + react-syntax-highlighter |
| Upload | react-dropzone |
| Data fetching | TanStack Query (React Query) |
| Validation | Zod 4 |
| Icons | Lucide React |
| Toasts | Sonner |
| Typography | @tailwindcss/typography |

---

## Quick Start

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd ai-notes-vault

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local and add your Google Client ID (see setup below)

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Google Cloud Setup (Step by Step)

You need a Google Cloud project with OAuth credentials to run this app. Here is every step.

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. At the top-left, click the **project dropdown** (it may say "Select a project" or show an existing project name)
3. In the dialog, click **New Project** (top-right of the dialog)
4. Fill in:
   - **Project name:** `AI Notes Vault` (or any name you like)
   - **Organization:** leave as default
5. Click **Create**
6. Wait a few seconds, then make sure the new project is selected in the dropdown

### Step 2: Enable the Google Drive API

1. In the left sidebar, go to **APIs & Services** > **Library**
   - Or use the search bar at the top and type "Google Drive API"
2. Click on **Google Drive API** in the results
3. Click the blue **Enable** button
4. Wait for it to enable (you'll be redirected to the API details page)

### Step 3: Configure the OAuth Consent Screen

This tells Google what your app is and what permissions it requests.

1. Go to **APIs & Services** > **OAuth consent screen** (left sidebar)
2. Select **External** as user type (this is the only option for personal Google accounts)
3. Click **Create**
4. Fill in the required fields:
   - **App name:** `AI Notes Vault`
   - **User support email:** select your email
   - **Developer contact information:** your email
5. Click **Save and Continue**
6. On the **Scopes** page:
   - Click **Add or Remove Scopes**
   - In the search/filter box, search for each of these and check them:
     - `https://www.googleapis.com/auth/drive` (Google Drive - see all files)
     - `https://www.googleapis.com/auth/userinfo.email` (see your email)
     - `https://www.googleapis.com/auth/userinfo.profile` (see your basic profile)
   - Click **Update** at the bottom of the scope selection panel
   - Click **Save and Continue**
7. On the **Test users** page:
   - Click **Add Users**
   - Enter **your own Google email address**
   - Click **Add**
   - Click **Save and Continue**
8. Review the summary and click **Back to Dashboard**

**Why test users?** While your app is in "Testing" mode (not published), only users you explicitly add here can sign in. For personal use, just add yourself.

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials** (left sidebar)
2. Click **+ Create Credentials** (at the top) > **OAuth client ID**
3. Choose **Application type:** `Web application`
4. **Name:** `AI Notes Vault Web` (or any name)
5. Under **Authorized JavaScript origins**, click **Add URI** and enter:
   ```
   http://localhost:3000
   ```
6. Under **Authorized redirect URIs**, click **Add URI** and enter:
   ```
   http://localhost:3000
   ```
7. Click **Create**
8. A dialog appears with your **Client ID** and **Client Secret**
   - **Copy the Client ID** - it looks like: `123456789012-abcdefghijklmnop.apps.googleusercontent.com`
   - You do NOT need the Client Secret for this app (we use the implicit flow)

### Step 5: Add the Client ID to Your Project

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnop.apps.googleusercontent.com
```

Replace the value with YOUR actual Client ID from Step 4.

### Important: Why We Use the `drive` Scope

We initially tried using `drive.file` (the most restrictive scope) which only allows access to files the app creates. However, Google's `drive.file` scope does **not** support the `'folderId' in parents` query pattern needed to list files inside a folder. Google treats that as a broad list operation requiring the full `drive` scope.

Since this is a personal app and the UI strictly filters to only show markdown files within the `AI_NOTES` folder, using `drive` is the pragmatic trade-off. The app never reads or modifies files outside `AI_NOTES`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Your Google OAuth 2.0 Client ID |

The `NEXT_PUBLIC_` prefix makes this available to client-side code. This is safe - the Client ID is not a secret (it's embedded in every Google sign-in button on the web). The actual security comes from the OAuth redirect URI whitelist configured in Google Cloud Console.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### First-Time Usage Flow

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Sign in with Google**
3. Google shows the consent screen - check all permission boxes and click **Allow**
4. The app automatically creates an `AI_NOTES` folder in your Google Drive
5. Drag and drop `.md` files onto the upload zone
6. Click any file in the sidebar to read it
7. Toggle between rendered and raw view

---

## Project Structure

```
ai-notes-vault/
├── docs/                          # Implementation documentation
│   ├── ARCHITECTURE.md            # System architecture deep-dive
│   ├── GOOGLE-INTEGRATION.md      # Google OAuth + Drive details
│   └── IMPLEMENTATION-LOG.md      # Step-by-step build log
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout, fonts, providers, theme script
│   │   ├── page.tsx               # Entry point → AppShell
│   │   └── globals.css            # Tailwind v4 + shadcn theme variables
│   ├── components/
│   │   ├── layout/
│   │   │   ├── top-bar.tsx        # App header: title, breadcrumbs, theme, user menu
│   │   │   └── theme-toggle.tsx   # Dark/light/system theme switcher
│   │   ├── vault/
│   │   │   ├── app-shell.tsx      # Auth gate: landing vs dashboard
│   │   │   ├── dashboard.tsx      # Main app layout: sidebar + reader + upload
│   │   │   ├── landing-page.tsx   # Unauthenticated landing/sign-in page
│   │   │   └── sidebar.tsx        # File browser: search, sort, folders, file list
│   │   ├── upload/
│   │   │   └── upload-zone.tsx    # Drag-and-drop upload with validation
│   │   ├── markdown/
│   │   │   └── markdown-reader.tsx # Rendered + raw markdown viewer
│   │   ├── ui/                    # shadcn/ui primitive components
│   │   └── providers.tsx          # All context providers (Query, Auth, Theme, Tooltip)
│   ├── hooks/
│   │   ├── use-auth.tsx           # Google OAuth context + session management
│   │   ├── use-vault.tsx          # Vault state: folder bootstrap + navigation
│   │   ├── use-drive-files.ts     # TanStack Query hooks for Drive CRUD
│   │   └── use-theme.tsx          # Dark mode context + localStorage persistence
│   ├── services/
│   │   └── google-drive.ts        # All Google Drive API calls (isolated)
│   ├── types/
│   │   └── index.ts               # TypeScript types + Zod schemas
│   └── lib/
│       ├── constants.ts           # App constants (scopes, folder name, etc.)
│       ├── env.ts                 # Environment variable validation
│       └── utils.ts               # Tailwind merge utility (cn)
├── .env.local.example             # Environment variable template
├── package.json
├── tsconfig.json
└── README.md                      # This file
```

---

## How It Works

### Authentication Flow

1. App loads → GIS (Google Identity Services) script loads
2. User clicks "Sign in with Google" → GIS opens consent popup
3. User approves → GIS returns an access token with the requested scopes
4. App verifies the token has `drive` scope via Google's `tokeninfo` endpoint
5. Token is stored in `sessionStorage` (cleared when tab closes)
6. On next page load, the saved token is validated before reuse
7. If validation fails (expired/wrong scopes), user is shown the sign-in page

### Vault Bootstrap

1. After auth, the `VaultProvider` calls `ensureRootFolder()`
2. This searches for a folder named `AI_NOTES` in Drive
3. If found, uses it. If not, creates it.
4. The folder ID is stored in React state as the "current folder"
5. All file operations target this folder (or its subfolders)

### Upload Flow

1. User drops files onto the upload zone (react-dropzone)
2. Each file is validated with Zod (extension + size check)
3. For each file, check if a file with the same name exists in the target folder
4. If duplicate found, prompt the user: replace / keep-both / cancel
5. Upload via multipart request to the Drive API
6. Progress tracked via XMLHttpRequest upload events
7. TanStack Query cache invalidated to refresh the file list

### File Reading

1. User clicks a file in the sidebar
2. TanStack Query fetches the file content via `files/{id}?alt=media`
3. Content is rendered via react-markdown with remark-gfm
4. Code blocks use react-syntax-highlighter with the One Dark theme
5. Toggle between rendered and raw markdown view

---

## Dark Mode

The app supports three theme modes:

| Mode | Behavior |
|------|----------|
| **Light** | Always light theme |
| **Dark** | Always dark theme |
| **System** | Follows your OS/browser preference |

The theme toggle is in the top-right of both the landing page and the main app. Preference is persisted to `localStorage` and an inline `<script>` in the HTML `<head>` prevents flash of wrong theme on page load.

---

## File Types

| Extension | Upload | Render | Notes |
|-----------|--------|--------|-------|
| `.md` | Yes | Yes | Full support |
| `.markdown` | Yes | Yes | Full support |
| `.mdx` | Yes | Raw only | JSX components not executed |

**Max file size:** 10 MB

The app uses Zod validation on the client to reject non-markdown files before they hit the Drive API.

---

## Troubleshooting

### "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set"

You need a `.env.local` file. Copy the example:

```bash
cp .env.local.example .env.local
```

Then add your Client ID. Restart the dev server after creating/changing this file.

### "Request had insufficient authentication scopes" (403)

This means the access token doesn't have Drive permission. Fix:

1. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Find your app and click **Remove Access**
3. In Google Cloud Console, verify the OAuth consent screen has the `drive` scope
4. Restart the dev server
5. Sign in again - make sure you **check all boxes** in the consent popup

### "Drive scope not granted" in console

The user unchecked the Drive permission in the consent popup. Sign out and sign in again, checking all boxes.

### Token expires

The implicit flow token lasts about 1 hour. When it expires, Drive API calls will fail and the app shows the bootstrap error screen. Sign out and sign in again.

### "This app isn't verified" warning

This is normal when the consent screen is in "Testing" mode. Click **Continue** (you may need to click "Advanced" first). Only test users you added can see this.

---

## Documentation

For in-depth technical documentation, see the `docs/` folder:

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, component hierarchy, data flow, state management |
| [GOOGLE-INTEGRATION.md](docs/GOOGLE-INTEGRATION.md) | Google OAuth flow, Drive API usage, scope decisions, token management |
| [IMPLEMENTATION-LOG.md](docs/IMPLEMENTATION-LOG.md) | Step-by-step build log of every decision made during development |

---

## What This App Does NOT Do

This is a focused personal tool. It intentionally does not:

- Edit markdown in the browser
- Sync offline
- Support multiple users or collaboration
- Index or search file contents (search is filename-only)
- Provide AI summarization or vector search
- Act as a general-purpose Drive file manager
- Support non-markdown file types

---

## License

Personal project. Use as you like.
