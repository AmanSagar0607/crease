import type { Metadata } from 'next';
import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Sign in — Zappa',
  description: 'Sign in to your Zappa analytics workspace.',
};

export default function SignInPage() {
  return (
    <main className="auth-page">
      <Link className="auth-wordmark" href="/" aria-label="Zappa home">
        Zappa<span aria-hidden="true">.</span>
      </Link>
      <p className="auth-eyebrow">YOUR ANALYTICS WORKSPACE</p>
      <h1>Welcome back.</h1>
      <p className="auth-intro">Sign in to see what is working across your sites.</p>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
      />
      <p className="auth-footnote">One account. One secure session. No separate app password.</p>
    </main>
  );
}
