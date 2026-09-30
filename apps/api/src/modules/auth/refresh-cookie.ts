import { parseCookie, stringifySetCookie } from 'cookie';
import type { Request, Response } from 'express';
import { refreshError } from './refresh-token.service.js';
export const refreshCookieName = (secure: boolean) =>
  secure ? '__Host-dl_refresh' : 'dl_refresh';
export function readRefreshCookie(req: Request, secure: boolean) {
  const header = req.headers.cookie ?? '';
  const name = refreshCookieName(secure);
  const count = header
    .split(';')
    .filter((part) => part.trim().split('=')[0] === name).length;
  if (!count) throw refreshError('MISSING');
  if (count !== 1) throw refreshError('INVALID');
  const value = parseCookie(header, { decode: (value) => value })[name];
  if (!value) throw refreshError('INVALID');
  return value;
}
export function setRefreshCookie(
  res: Response,
  secure: boolean,
  value: string,
  expiresAt: Date,
  now = new Date(),
) {
  res.append(
    'Set-Cookie',
    stringifySetCookie({
      name: refreshCookieName(secure),
      value,
      secure,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
      maxAge: Math.max(
        0,
        Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
      ),
    }),
  );
}
export function clearRefreshCookie(res: Response, secure: boolean) {
  setRefreshCookie(res, secure, '', new Date(0));
}
