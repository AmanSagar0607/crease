import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import { clerkConfigured } from '@/lib/clerk-config';

export const metadata: Metadata = {
  title: 'Create an account — Zappa',
  description: 'Create a secure account for your Zappa analytics workspace.',
};

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <Link className="auth-wordmark" href="/" aria-label="Zappa home">
        Zappa<span aria-hidden="true">.</span>
      </Link>
      <p className="auth-eyebrow">START WITH YOUR OWN DATA</p>
      <h1>Make the next move clearer.</h1>
      <p className="auth-intro">Create an account to set up your first analytics workspace.</p>
      {clerkConfigured ? (
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          forceRedirectUrl="/dashboard"
        />
      ) : (
        <p className="auth-intro" role="status">
          Account creation is unavailable because Clerk authentication is not configured for this environment.
        </p>
      )}
      <p className="auth-footnote">Email verification and account recovery are handled securely by Clerk.</p>
    </main>
  );
}
