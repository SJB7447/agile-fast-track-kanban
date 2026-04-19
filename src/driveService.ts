// Google Drive API v3 Service Utilities

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER_NAME = 'Fast-Track Agile';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

async function driveRequest(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason ?? '';
    // insufficientPermissions / insufficientScopes → need re-auth
    // accessNotConfigured → Drive API not enabled in Google Cloud
    if (reason === 'accessNotConfigured') throw new Error('DRIVE_API_NOT_ENABLED');
    throw new Error('PERMISSION_DENIED');
  }
  if (!res.ok) throw new Error(`Drive API Error: ${res.status}`);
  return res.json();
}

/** Find or create the app-specific folder */
export async function getOrCreateAppFolder(token: string): Promise<string> {
  // Search for existing folder
  const q = `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const data = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
    token
  );

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create new folder
  const folder = await driveRequest(`${DRIVE_API}/files`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  return folder.id;
}

/** List files in the app folder */
export async function listFiles(token: string, folderId: string): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const fields = 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,thumbnailLink)';
  const data = await driveRequest(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=modifiedTime desc&pageSize=50`,
    token
  );
  return data.files || [];
}

/** Upload a file to the app folder */
export async function uploadFile(
  token: string,
  folderId: string,
  file: File
): Promise<DriveFile> {
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,iconLink`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) throw new Error(`Upload Error: ${res.status}`);
  return res.json();
}

/** Delete a file */
export async function deleteFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok && res.status !== 204) throw new Error(`Delete Error: ${res.status}`);
}

/** Create a subfolder inside a parent folder */
export async function createDriveFolder(token: string, name: string, parentId: string): Promise<DriveFile> {
  const folder = await driveRequest(`${DRIVE_API}/files?fields=id,name,mimeType,modifiedTime,webViewLink`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  return folder;
}

/** Rename a file or folder */
export async function renameFile(token: string, fileId: string, newName: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) throw new Error(`Rename Error: ${res.status}`);
}

/** Extract Google Drive folder ID from URL or raw ID */
export function extractFolderIdFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Matches /folders/<id> pattern (with optional /u/<n>/ prefix)
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) return urlMatch[1];

  // Support ?id=<id> query param form
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch && queryMatch[1]) return queryMatch[1];

  // Raw ID: at least 20 chars of [A-Za-z0-9_-]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

/** Get human-readable file size */
export function formatFileSize(bytes?: string): string {
  if (!bytes) return '—';
  const b = parseInt(bytes, 10);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Get icon for file type */
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.includes('folder')) return '📁';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('video')) return '🎬';
  if (mimeType.includes('audio')) return '🎵';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
  if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('xml')) return '📄';
  return '📎';
}
