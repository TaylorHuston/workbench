// Session and legacy file URLs identify opaque hashes, never local absolute paths.
export function sessionUrl(key) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid session key');
  return `/?${new URLSearchParams({ session: key })}`;
}
export function parseSessionUrl(input) {
  const url = new URL(input, 'http://127.0.0.1');
  if (url.pathname !== '/' || url.searchParams.size !== 1 || url.searchParams.getAll('session').length !== 1) return null;
  const key = url.searchParams.get('session'); return /^[a-f0-9]{64}$/.test(key) ? { sessionKey: key } : null;
}

export function fileUrl(workspaceId, path) {
  if (!/^[a-f0-9]{64}$/.test(workspaceId)) throw new Error('Invalid workspace ID');
  if (path !== undefined && !validFile(path)) throw new Error('Invalid Markdown path');
  const query = new URLSearchParams({ workspace: workspaceId });
  if (path !== undefined) query.set('file', path);
  return `/?${query}`;
}
function validFile(path) {
  return typeof path === 'string' && !!path && !path.startsWith('/') && !path.includes('\0') && !path.includes('\\') && path.toLowerCase().endsWith('.md') && path.split('/').every((part) => part && part !== '.' && part !== '..');
}
export function parseFileUrl(input) {
  const url = new URL(input, 'http://127.0.0.1');
  if (url.pathname !== '/' || url.searchParams.getAll('workspace').length !== 1 || url.searchParams.getAll('file').length > 1) return null;
  const workspaceId = url.searchParams.get('workspace'), path = url.searchParams.get('file');
  if (!/^[a-f0-9]{64}$/.test(workspaceId) || (path !== null && !validFile(path))) return null;
  return { workspaceId, path };
}
