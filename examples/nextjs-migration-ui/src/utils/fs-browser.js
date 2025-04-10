/**
 * Browser-compatible implementation of Node.js fs module
 * This provides dummy implementations that do nothing but don't crash
 */

// File existence check (always returns true in browser)
export function existsSync() {
  return true;
}

// Directory creation (no-op in browser)
export function mkdirSync() {
  return true;
}

// File reading (returns empty buffer in browser)
export function readFileSync() {
  return Buffer.from([]);
}

// File writing (no-op in browser)
export function writeFileSync() {
  return true;
}

// Create dummy write stream
export function createWriteStream() {
  return {
    write: () => {},
    end: () => {},
    on: (event, callback) => {
      if (event === 'finish' && callback) {
        setTimeout(callback, 0);
      }
      return this;
    }
  };
}

// Default export for ESM imports
export default {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  createWriteStream
}; 