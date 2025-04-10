/**
 * Formats a byte value into a human-readable string with appropriate units.
 * 
 * @param bytes - The number of bytes to format
 * @param decimals - The number of decimal places to include (default: 2)
 * @returns A formatted string representing the byte value (e.g., "2.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Formats time in seconds to a human-readable string.
 * 
 * @param seconds - The number of seconds to format
 * @returns A formatted time string (e.g., "2h 30m 15s" or "45s")
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) return 'Unknown';
  if (seconds === 0) return '0s';
  
  if (seconds < 1) {
    return 'Less than 1s';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  let timeString = '';
  
  if (hours > 0) {
    timeString += `${hours}h `;
  }
  
  if (minutes > 0 || hours > 0) {
    timeString += `${minutes}m `;
  }
  
  timeString += `${remainingSeconds}s`;
  
  return timeString;
}

/**
 * Formats a date to a human-readable string.
 * 
 * @param date - The date to format
 * @returns A formatted date string (e.g., "Apr 3, 2023 14:30:45")
 */
export function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Calculates speed in bytes per second.
 * 
 * @param bytesTransferred - The number of bytes transferred
 * @param elapsedTime - The elapsed time in seconds
 * @returns The speed in bytes per second
 */
export function calculateSpeed(bytesTransferred: number, elapsedTime: number): number {
  if (elapsedTime <= 0) return 0;
  return bytesTransferred / elapsedTime;
}

/**
 * Formats a speed value in bytes per second to a human-readable string.
 * 
 * @param bytesPerSecond - The speed in bytes per second
 * @returns A formatted speed string (e.g., "2.5 MB/s")
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
} 