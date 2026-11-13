import type { Metadata } from 'next';
import LoginView from './LoginView';

export const metadata: Metadata = {
  title: 'Sign in — Crease',
  description: 'Sign in to Crease with GitHub to open your analytics workspace.',
};

export default function LoginPage() {
  return <LoginView />;
}
