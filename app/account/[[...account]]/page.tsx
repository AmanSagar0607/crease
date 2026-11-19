import type { Metadata } from 'next';
import Link from 'next/link';
import { UserProfile } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Account settings — Zappa',
  description: 'Manage your Zappa profile, security settings, and account lifecycle.',
};

export default function AccountPage() {
  return (
    <main className="auth-page account-page">
      <Link className="auth-wordmark" href="/dashboard" aria-label="Back to Zappa dashboard">
        Zappa<span aria-hidden="true">.</span>
      </Link>
      <p className="auth-eyebrow">ACCOUNT</p>
      <h1>Your account.</h1>
      <p className="auth-intro">Manage your profile, sign-in methods, and security settings.</p>
      <UserProfile path="/account" routing="path" />
    </main>
  );
}
