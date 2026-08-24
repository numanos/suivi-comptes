import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AuthUser = { id: number; email: string; name: string; role: string };

export async function createSession(userId: number) {
  const token = randomBytes(32).toString('hex');
  await query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
    [token, userId]
  );
  return token;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const rows = await query(
    `SELECT u.id, u.email, u.name, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()`,
    [token]
  ) as AuthUser[];
  return rows[0] || null;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await query('DELETE FROM sessions WHERE token = ?', [token]);
}

export async function requireUser() {
  const user = await getCurrentUser();
  return user || NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  return user.role === 'admin'
    ? user
    : NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
}

export { SESSION_TTL_SECONDS };
