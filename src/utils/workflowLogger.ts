export const createLogger = (component: string) => ({
  info: (msg: string, data?: any) => console.log(`[${component}][${new Date().toISOString()}] INFO: ${msg}`, data ? data : ''),
  error: (msg: string, error?: any) => console.error(`[${component}][${new Date().toISOString()}] ERROR: ${msg}`, error ? error : ''),
  debug: (msg: string, data?: any) => console.debug(`[${component}][${new Date().toISOString()}] DEBUG: ${msg}`, data ? data : '')
}); 