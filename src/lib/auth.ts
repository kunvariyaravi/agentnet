import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { v4 as uuid } from 'uuid';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'agentnet-secret-key-change-in-production');

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
    .setExpirationTime('7d')
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
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function createUser(email: string, password: string, name: string): Promise<SessionUser> {
  const db = getDb();
  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run(id, email, name, hash);
  return { id, email, name, role: 'user' };
}

export function generateWorkNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
