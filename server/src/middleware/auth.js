import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { unauthorized } from '../utils/httpError.js';

export const AUTH_COOKIE = 'dl_token';

export function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

/** Requires a valid session cookie and loads the user onto req.user. */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized('Your session has expired. Please log in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  req.user = user;
  next();
}
