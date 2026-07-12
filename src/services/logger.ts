const isDev = import.meta.env.DEV;

function redactText(value: unknown): string {
  return String(value)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{19,}/gi, "[uuid]")
    .replace(/\b[0-9a-z_-]{32,}\b/gi, "[identifier]")
    .replace(/\b\d{16,}\b/g, "[number]");
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
    else console.warn(`[Votex] ${redactText(args[0] ?? "Warning")}`);
  },
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
    else console.error(`[Votex] ${redactText(args[0] ?? "Error")}`);
  },
};
