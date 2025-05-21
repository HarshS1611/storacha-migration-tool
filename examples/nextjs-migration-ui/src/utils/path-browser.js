/**
 * Browser-compatible implementation of Node.js path module
 */

export function join(...paths) {
  return paths.join('/').replace(/\/+/g, '/');
}

export function resolve(...paths) {
  return join(...paths);
}

export function dirname(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '.';
}

export function basename(path, ext) {
  const filename = path.split('/').pop() || '';
  if (ext && filename.endsWith(ext)) {
    return filename.slice(0, -ext.length);
  }
  return filename;
}

export function extname(path) {
  const filename = basename(path);
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex < 0 ? '' : filename.slice(dotIndex);
}

export function isAbsolute(path) {
  return path.startsWith('/');
}

// Create a default export for ESM imports
export default {
  join,
  resolve,
  dirname,
  basename,
  extname,
  isAbsolute
}; 