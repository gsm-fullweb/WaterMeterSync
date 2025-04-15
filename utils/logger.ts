// Utility for detailed logging of sync operations

// Log levels
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

// Log entry structure
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
}

// In-memory log storage
let logs: LogEntry[] = [];
const MAX_LOGS = 1000;

// Add a log entry
export const log = (level: LogLevel, message: string, context?: any): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context ? JSON.stringify(context) : undefined,
  };

  // Add to in-memory logs
  logs.unshift(entry);

  // Trim logs if they exceed maximum
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(0, MAX_LOGS);
  }

  // Also output to console
  const consoleMessage = `[${entry.timestamp}] [${level}] ${message}`;
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(consoleMessage, context || "");
      break;
    case LogLevel.INFO:
      console.info(consoleMessage, context || "");
      break;
    case LogLevel.WARN:
      console.warn(consoleMessage, context || "");
      break;
    case LogLevel.ERROR:
      console.error(consoleMessage, context || "");
      break;
  }
};

// Convenience methods
export const logDebug = (message: string, context?: any): void =>
  log(LogLevel.DEBUG, message, context);
export const logInfo = (message: string, context?: any): void =>
  log(LogLevel.INFO, message, context);
export const logWarn = (message: string, context?: any): void =>
  log(LogLevel.WARN, message, context);
export const logError = (message: string, context?: any): void =>
  log(LogLevel.ERROR, message, context);

// Get all logs
export const getLogs = (): LogEntry[] => [...logs];

// Clear logs
export const clearLogs = (): void => {
  logs = [];
};

// Get logs by level
export const getLogsByLevel = (level: LogLevel): LogEntry[] => {
  return logs.filter((entry) => entry.level === level);
};

// Get recent logs (last n entries)
export const getRecentLogs = (count: number = 50): LogEntry[] => {
  return logs.slice(0, Math.min(count, logs.length));
};

// Export a retry utility with exponential backoff
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    operationName?: string;
  } = {},
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    operationName = "operation",
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      if (attempt > 1) {
        logInfo(`Retry attempt ${attempt - 1} for ${operationName}`);
      }

      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt <= maxRetries) {
        logWarn(`${operationName} failed, retrying in ${delay}ms`, {
          error,
          attempt,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * factor, maxDelay);
      } else {
        logError(`${operationName} failed after ${maxRetries} retries`, {
          error,
        });
      }
    }
  }

  throw lastError;
};
