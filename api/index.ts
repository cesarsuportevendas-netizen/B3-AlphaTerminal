import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../server/app.js';

export default function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  const rawUrl = req.url || '/';
  const parsed = new URL(rawUrl, 'http://localhost');
  const rewrittenPath = parsed.searchParams.get('__vercel_path');

  if (rewrittenPath !== null) {
    parsed.searchParams.delete('__vercel_path');
    const remainingQuery = parsed.searchParams.toString();
    const normalizedPath = rewrittenPath.replace(/^\/+/, '');
    req.url = `/api/${normalizedPath}${remainingQuery ? `?${remainingQuery}` : ''}`;
  } else if (!rawUrl.startsWith('/api')) {
    req.url = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  }

  return app(req as any, res as any);
}
