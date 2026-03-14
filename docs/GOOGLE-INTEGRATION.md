# Google Integration

This document explains exactly how AI Notes Vault uses Google OAuth and the Google Drive API, including every decision and trade-off.

---

## Table of Contents

- [Authentication: Google Identity Services](#authentication-google-identity-services)
- [OAuth Flow in Detail](#oauth-flow-in-detail)
- [Token Management](#token-management)
- [Scope Selection: Why `drive` Instead of `drive.file`](#scope-selection-why-drive-instead-of-drivefile)
- [Google Drive API Usage](#google-drive-api-usage)
- [API Endpoints Used](#api-endpoints-used)
- [Error Handling](#error-handling)
- [Security Considerations](#security-considerations)

---

## Authentication: Google Identity Services

We use [Google Identity Services (GIS)](https://developers.google.com/identity/oauth2/web/guides/overview), specifically the **Token Model** (implicit grant flow). This is Google's current recommended approach for client-side web apps that need access tokens.

### Why GIS Token Model (not Sign In With Google)?

Google offers two client-side auth approaches:

| Approach | Returns | Use case |
|----------|---------|----------|
| Sign In With Google | ID token (JWT) | Authentication only |
| GIS Token Model | Access token | Authentication + API access |

We need an **access token** to call the Google Drive API, so we use the Token Model.

### Why not the Authorization Code Flow?

| Flow | Token location | Refresh capability | Complexity |
|------|---------------|-------------------|------------|
| Implicit (our choice) | Browser only | No refresh token | Low |
| Authorization Code | Server-side | Has refresh token | High (needs backend) |

The authorization code flow would require a backend server to exchange the code for tokens and handle refresh. For an MVP personal tool, the implicit flow is simpler and sufficient. The trade-off is that tokens expire after ~1 hour and the user must re-authenticate.

---

## OAuth Flow in Detail

Here is exactly what happens when a user clicks "Sign in with Google":

### Step 1: GIS Script Loading

```
layout.tsx renders → AuthProvider mounts → useEffect fires
  → creates <script src="https://accounts.google.com/gsi/client">
  → script loads → onload callback fires
  → initTokenClient() creates a TokenClient with:
      - client_id: from NEXT_PUBLIC_GOOGLE_CLIENT_ID
      - scope: "drive userinfo.email userinfo.profile"
      - callback: function to handle the token response
```

### Step 2: User Clicks Sign In

```
signIn() called
  → sessionStorage cleared (remove stale tokens)
  → tokenClientRef.current.requestAccessToken({ prompt: "consent" })
  → Google opens consent popup in a new window
  → User sees permissions and clicks "Allow"
  → Google calls our callback with:
      {
        access_token: "ya29.a0Af...",
        expires_in: 3599,
        scope: "https://www.googleapis.com/auth/drive ...",
        token_type: "Bearer"
      }
```

### Step 3: Token Validation

```
callback fires with TokenResponse
  → check response.error (OAuth error)
  → parse response.scope, verify it includes "drive"
  → if scope missing: log error, stay on login page
  → if scope OK:
      → store token in sessionStorage
      → fetch user info from googleapis.com/oauth2/v2/userinfo
      → set user + token in React state
      → app renders Dashboard
```

### Step 4: Session Restore on Reload

```
AuthProvider mounts
  → check sessionStorage for saved token
  → if found: call googleapis.com/oauth2/v1/tokeninfo?access_token=...
      → verify response includes "drive" in scope
      → if valid: restore user session (no consent popup needed)
      → if invalid (expired/wrong scope): clear storage, show login
  → if not found: show login page
```

---

## Token Management

### Storage

| Storage | What | Lifetime |
|---------|------|----------|
| `sessionStorage` | Access token | Until tab closes |
| React state | Access token + user info | Until page navigates |

We use `sessionStorage` (not `localStorage`) because:
- Token expires after ~1 hour anyway
- Closing the tab clears it (more secure)
- Each tab gets its own session

### Validation

Before reusing a saved token, we call Google's tokeninfo endpoint:

```
GET https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=TOKEN
```

Response includes:
```json
{
  "issued_to": "CLIENT_ID",
  "audience": "CLIENT_ID",
  "scope": "https://www.googleapis.com/auth/drive ...",
  "expires_in": 2847
}
```

We check that `scope` includes `drive`. If not, the token is discarded.

### Revocation

On sign-out, we call:
```
google.accounts.oauth2.revoke(token, callback)
```

This tells Google to invalidate the token server-side, not just clear it locally.

---

## Scope Selection: Why `drive` Instead of `drive.file`

This was a significant decision. Here's the full context.

### What We Tried First: `drive.file`

`drive.file` is the most restrictive Drive scope. It only allows access to files that:
- Were created by the app
- Were explicitly opened by the user via Google Picker

This seemed ideal for a vault app that only manages its own files.

### What Went Wrong

The app creates an `AI_NOTES` folder and uploads files into it. To list those files, we use:

```
GET /drive/v3/files?q='FOLDER_ID' in parents
```

Google's Drive API interprets this as a **broad file listing operation**, even though we're scoping to a specific folder. With `drive.file`, this returns:

```json
{
  "error": {
    "code": 403,
    "message": "Request had insufficient authentication scopes.",
    "reason": "insufficientPermissions"
  }
}
```

### The Root Cause

Google's `drive.file` scope is designed for apps that work with **individual files**, not folder browsing patterns. The `in parents` query requires either:
- `drive` (full access)
- `drive.readonly` (read-only full access)

Neither of the narrow scopes (`drive.file`, `drive.appdata`) support folder content listing.

### Our Decision

We switched to `drive` (full access) because:

1. The app needs to list folder contents - there's no way around this
2. `drive.readonly` won't work because we also need to upload/create/delete
3. The app only ever operates inside the `AI_NOTES` folder
4. The UI enforces markdown-only filtering
5. This is a personal tool, not a multi-user SaaS

### If You Want Tighter Scopes

If you want to restrict scope further, you could:
1. Use `drive.appdata` to store files in the hidden app data folder (but then files aren't visible in Drive UI)
2. Add a server-side proxy that uses a service account with limited access
3. Use Google Picker API to let the user explicitly select files (works with `drive.file`)

These all add significant complexity beyond MVP scope.

---

## Google Drive API Usage

### Base URLs

| Purpose | URL |
|---------|-----|
| Metadata operations | `https://www.googleapis.com/drive/v3` |
| File upload | `https://www.googleapis.com/upload/drive/v3` |

### Authentication

Every request includes:
```
Authorization: Bearer {access_token}
```

### Folder Operations

#### Find a folder by name

```
GET /drive/v3/files
  ?q=mimeType='application/vnd.google-apps.folder' AND name='AI_NOTES' AND trashed=false
  &fields=files(id, name, parents)
  &pageSize=1
```

#### Create a folder

```
POST /drive/v3/files
Content-Type: application/json

{
  "name": "AI_NOTES",
  "mimeType": "application/vnd.google-apps.folder"
}
```

#### List subfolders

```
GET /drive/v3/files
  ?q='PARENT_ID' in parents AND mimeType='application/vnd.google-apps.folder' AND trashed=false
  &fields=files(id, name, parents)
  &orderBy=name
```

### File Operations

#### List files in a folder

```
GET /drive/v3/files
  ?q='FOLDER_ID' in parents AND trashed=false
  &fields=files(id, name, mimeType, modifiedTime, createdTime, size, parents, webViewLink)
  &orderBy=modifiedTime desc
  &pageSize=200
```

The response includes all file types. We filter to markdown files client-side by checking the file extension.

#### Upload a file (multipart)

```
POST /upload/drive/v3/files?uploadType=multipart
Content-Type: multipart/related; boundary="-----vault_boundary_TIMESTAMP"

------vault_boundary_TIMESTAMP
Content-Type: application/json; charset=UTF-8

{"name":"file.md","parents":["FOLDER_ID"],"mimeType":"text/markdown"}
------vault_boundary_TIMESTAMP
Content-Type: text/markdown

# File content here...
------vault_boundary_TIMESTAMP--
```

We use `XMLHttpRequest` instead of `fetch` for uploads because XHR supports upload progress events (`xhr.upload.onprogress`), which `fetch` does not.

#### Download file content

```
GET /drive/v3/files/FILE_ID?alt=media
```

Returns the raw file content as text.

#### Update file content (replace)

```
PATCH /upload/drive/v3/files/FILE_ID?uploadType=media
Content-Type: text/markdown

# New content...
```

#### Rename a file

```
PATCH /drive/v3/files/FILE_ID
Content-Type: application/json

{"name": "new-name.md"}
```

#### Trash a file

```
PATCH /drive/v3/files/FILE_ID
Content-Type: application/json

{"trashed": true}
```

---

## API Endpoints Used

| Endpoint | Method | Purpose | Service Function |
|----------|--------|---------|-----------------|
| `/drive/v3/files` | GET | List/search files and folders | `listMarkdownFiles`, `findFolder`, `findFileByName`, `listSubfolders` |
| `/drive/v3/files` | POST | Create folders | `createFolder` |
| `/upload/drive/v3/files` | POST | Upload files (multipart) | `uploadFile` |
| `/upload/drive/v3/files/{id}` | PATCH | Update file content | `updateFileContent` |
| `/drive/v3/files/{id}` | PATCH | Rename, trash | `renameFile`, `trashFile` |
| `/drive/v3/files/{id}?alt=media` | GET | Download file content | `getFileContent` |
| `/oauth2/v2/userinfo` | GET | Get user profile | `fetchUserInfo` (in use-auth) |
| `/oauth2/v1/tokeninfo` | GET | Validate token scopes | `verifyTokenScopes` (in use-auth) |

---

## Error Handling

### API Errors

Every service function checks `res.ok` and throws a descriptive error:

```typescript
if (!res.ok) {
  const body = await res.text();
  throw new Error(`Drive API error ${res.status}: ${body}`);
}
```

### Common Error Scenarios

| Error | Cause | How We Handle It |
|-------|-------|-----------------|
| 401 Unauthorized | Token expired | App shows bootstrap error, user re-authenticates |
| 403 Insufficient scopes | Wrong scope on token | Token validation catches this before Drive calls |
| 403 Rate limit | Too many API calls | TanStack Query retry (1 retry) |
| 404 Not found | File deleted externally | Error shown in reader, user can refresh |
| Network error | Offline / connectivity | XHR onerror → upload error state |

### Token Expiry

The implicit flow token lasts ~3600 seconds (1 hour). We don't implement automatic refresh because:
- The implicit flow doesn't provide a refresh token
- Server-side refresh requires a backend
- For a personal tool, re-signing in once an hour is acceptable

---

## Security Considerations

### What's Safe

- **Client ID in `NEXT_PUBLIC_*`**: The OAuth Client ID is not a secret. It's equivalent to the client ID embedded in any website's Google Sign-In button. Security comes from the redirect URI whitelist in Google Cloud Console.
- **Token in sessionStorage**: Cleared when the tab closes. Not accessible cross-origin. More secure than localStorage for short-lived tokens.
- **Token validation on restore**: We don't blindly trust saved tokens. Every restored token is verified against Google's tokeninfo endpoint.

### What to Be Aware Of

- **Access token in browser memory**: Any browser extension or XSS vulnerability could theoretically read the token. This is inherent to the implicit flow.
- **`drive` scope is broad**: The token could access any file in the user's Drive. The app doesn't, but a compromised token could.
- **No CSRF protection**: Not needed since we don't have server-side endpoints.

### For Production Hardening

If you wanted to make this production-ready for multiple users:
1. Switch to authorization code flow with a backend
2. Store tokens server-side in encrypted sessions
3. Use `drive.file` scope + Google Picker for file selection
4. Add Content Security Policy headers
5. Implement token refresh on the server
