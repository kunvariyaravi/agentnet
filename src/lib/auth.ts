import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { queryOne, run, ensureSchema } from './db';
import { randomBytes } from 'crypto';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('agentnet_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function loginUser(email: string, password: string): Promise<SessionUser | null> {
  await ensureSchema();
  const user = await queryOne<{ id: string; email: string; name: string; role: string; password_hash: string }>(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function createUser(email: string, password: string, name: string): Promise<SessionUser> {
  await ensureSchema();
  const hash = await bcrypt.hash(password, 12);
  const result = await queryOne<{ id: string }>(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [email, name, hash]
  );
  return { id: result!.id, email, name, role: 'user' };
}

export function generateWorkNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) result += chars.charAt(bytes[i] % chars.length);
  return result;
}
