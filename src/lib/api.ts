export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL?.trim() || (import.meta.env.DEV ? 'http://localhost:4001' : '')
).replace(/\/$/, '');
