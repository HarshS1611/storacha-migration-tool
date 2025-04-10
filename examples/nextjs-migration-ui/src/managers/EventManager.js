/**
 * Mock EventManager to replace the Node.js-dependent one from the library
 * This file is imported by the library instead of the original EventManager.js
 */

import { BrowserEventManager } from '../utils/BrowserEventManager';

// Export the browser-compatible EventManager as the default export
export const EventManager = BrowserEventManager;

// Also export it as default for ESM imports
export default BrowserEventManager; 