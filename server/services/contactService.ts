import crypto from 'crypto';
import { getDb } from '../database.ts';

export interface ContactSubmissionInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactSubmissionRecord extends ContactSubmissionInput {
  id: string;
  createdAt: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function saveContactMessage(input: ContactSubmissionInput): ContactSubmissionRecord {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim();
  const subject = String(input.subject || '').trim();
  const message = String(input.message || '').trim();

  if (name.length < 2 || name.length > 100) {
    throw new Error('Please enter a valid name (2–100 characters).');
  }
  if (!EMAIL_REGEX.test(email) || email.length > 150) {
    throw new Error('Please enter a valid email address.');
  }
  if (subject.length < 3 || subject.length > 160) {
    throw new Error('Please enter a subject (3–160 characters).');
  }
  if (message.length < 10 || message.length > 4000) {
    throw new Error('Please enter a message of at least 10 characters.');
  }

  const record: ContactSubmissionRecord = {
    id: crypto.randomUUID(),
    name,
    email,
    subject,
    message,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO contact_messages (id, name, email, subject, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(record.id, record.name, record.email, record.subject, record.message, record.createdAt);

  return record;
}
