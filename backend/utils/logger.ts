// backend/utils/logger.ts
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const LOG_LEVEL_COLORS = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m',  // Green
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  RESET: '\x1b[0m',             // Reset color
};

const localLogFilePath = process.env.LOCAL_LOG_FILE;
const isVercelEnvironment = !!process.env.VERCEL;

// Ensure the log directory exists if localLogFilePath is set
if (localLogFilePath && !isVercelEnvironment) {
  const logDir = path.dirname(localLogFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

interface LogOptions {
  context?: string;
  data?: any;
}

function formatLogMessage(
  level: LogLevel,
  message: string,
  options?: LogOptions,
): string {
  const timestamp = new Date().toISOString();
  const contextString = options?.context ? ` [${options.context}]` : '';
  let logString = `${timestamp} [${level}]${contextString}: ${message}`;

  if (options?.data) {
    try {
      const dataString = JSON.stringify(options.data, null, 2);
      logString += `\nData:\n${dataString}`;
    } catch (error) {
      logString += `\nData: (Error serializing data: ${error instanceof Error ? error.message : 'Unknown error'})`;
    }
  }
  return logString;
}

function consoleLog(level: LogLevel, formattedMessage: string) {
  const color = LOG_LEVEL_COLORS[level] || LOG_LEVEL_COLORS.RESET;
  const resetColor = LOG_LEVEL_COLORS.RESET;

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(`${color}${formattedMessage}${resetColor}`);
      break;
    case LogLevel.INFO:
      console.info(`${color}${formattedMessage}${resetColor}`);
      break;
    case LogLevel.WARN:
      console.warn(`${color}${formattedMessage}${resetColor}`);
      break;
    case LogLevel.ERROR:
      console.error(`${color}${formattedMessage}${resetColor}`);
      break;
    default:
      console.log(`${color}${formattedMessage}${resetColor}`);
  }
}

function fileLog(formattedMessage: string) {
  if (localLogFilePath && !isVercelEnvironment) {
    try {
      fs.appendFileSync(localLogFilePath, formattedMessage + '\n', 'utf8');
    } catch (err) {
      // Fallback to console if file logging fails
      console.error(LOG_LEVEL_COLORS[LogLevel.ERROR] + 
        `Failed to write to local log file ${localLogFilePath}: ${err instanceof Error ? err.message : 'Unknown error'}` +
        LOG_LEVEL_COLORS.RESET
      );
    }
  }
}

export class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, data?: any) {
    const formattedMessage = formatLogMessage(level, message, { context: this.context, data });
    
    // Always log to console (Vercel will pick this up)
    consoleLog(level, formattedMessage);
    
    // Log to file only if LOCAL_LOG_FILE is set and not in Vercel environment
    fileLog(formattedMessage);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any, data?: any): void {
    let errorMessage = message;
    let logData = data;

    if (error) {
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
        if (error.stack) {
           // Add stack to data if not already there, to avoid duplicating it in the main message
          logData = { ...logData, stack: error.stack };
        }
      } else {
        try {
          errorMessage += `: ${JSON.stringify(error)}`;
        } catch {
          errorMessage += `: (Unserializable error object)`;
        }
      }
    }
    this.log(LogLevel.ERROR, errorMessage, logData);
  }
}

// Default logger instance (without context)
export const defaultLogger = new Logger();

// You can create contextual loggers like this:
// export const apiLogger = new Logger('API');
// export const mcpLogger = new Logger('MCP'); 