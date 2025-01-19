type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'perf';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  perf: 1,
  info: 2,
  warn: 3,
  error: 4
};

// Default to warn level in all environments
const DEFAULT_LOG_LEVEL: LogLevel = 'warn';

// Allow override through localStorage for debugging
const getLogLevel = (): LogLevel => {
  try {
    const storedLevel = localStorage.getItem('workflow.logLevel');
    if (storedLevel && storedLevel in LOG_LEVEL_PRIORITY) {
      return storedLevel as LogLevel;
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return DEFAULT_LOG_LEVEL;
};

export const createLogger = (component: string) => {
  const timers = new Map<string, number>();
  
  const shouldLog = (level: LogLevel): boolean => {
    const currentLevel = getLogLevel();
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
  };

  const formatMessage = (level: LogLevel, msg: string, data?: any) => 
    `[${component}][${new Date().toISOString()}] ${level.toUpperCase()}: ${msg}`;

  return {
    info: (msg: string, data?: any) => {
      if (shouldLog('info')) {
        console.log(formatMessage('info', msg), data ? data : '');
      }
    },
    error: (msg: string, error?: any) => {
      if (shouldLog('error')) {
        console.error(formatMessage('error', msg), error ? error : '');
      }
    },
    debug: (msg: string, data?: any) => {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', msg), data ? data : '');
      }
    },
    warn: (msg: string, data?: any) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', msg), data ? data : '');
      }
    },
    perf: (msg: string, data?: any) => {
      if (shouldLog('perf')) {
        console.log(formatMessage('perf', msg), data ? data : '');
      }
    },
    startTimer: (label: string) => {
      if (shouldLog('perf')) {
        timers.set(label, performance.now());
      }
    },
    endTimer: (label: string) => {
      if (!shouldLog('perf')) {
        return 0;
      }
      const start = timers.get(label);
      if (start) {
        const duration = performance.now() - start;
        console.log(formatMessage('perf', `${label} took ${duration.toFixed(2)}ms`));
        timers.delete(label);
        return duration;
      }
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', `No timer found for label: ${label}`));
      }
      return 0;
    }
  };
}; 