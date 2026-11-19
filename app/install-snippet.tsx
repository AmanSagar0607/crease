'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import s from './landing.module.css';

const installCommand = 'npm install @aman-sagar06077/zappa-analytics';

export default function InstallSnippet() {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setMessage('Install command copied.');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage('Copy is unavailable here. Select the command and copy it manually.');
    }
  }

  return (
    <div className={s.installSnippet}>
      <code><span aria-hidden="true">$</span> {installCommand}</code>
      <button type="button" onClick={copyCommand} aria-label="Copy npm install command">
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <span className={s.srOnly} role="status" aria-live="polite">{message}</span>
    </div>
  );
}
