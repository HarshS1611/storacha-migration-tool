import { Logger } from "../../../../dist/types";

type LogLevel = 'info' | 'error' | 'warn' | 'debug';

export interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  args?: any[];
  error?: Error;
}

type LogCallback = (log: LogMessage) => void;

export class CustomLogger implements Logger {
  private subscribers: Set<LogCallback> = new Set();

  subscribe(callback: LogCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(level: LogLevel, message: string, error?: Error, ...args: any[]) {
    const logMessage: LogMessage = {
      level,
      message,
      timestamp: new Date().toISOString(),
      args: args.length > 0 ? args : undefined,
      error
    };

    this.subscribers.forEach(callback => callback(logMessage));
  }

  info(message: string, ...args: any[]): void {
    this.notify('info', message, undefined, ...args);
  }

  error(message: string, error?: Error, ...args: any[]): void {
    this.notify('error', message, error, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.notify('warn', message, undefined, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.notify('debug', message, undefined, ...args);
  }
} 