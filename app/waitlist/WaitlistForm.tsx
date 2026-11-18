'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import s from './waitlist.module.css';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function WaitlistForm() {
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState('submitting');
    setMessage('');

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.get('email'), consent: formData.get('consent') === 'on' }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? 'Please wait a moment before trying again.' : 'We couldn’t add you just now. Please try again.');
      setState('success');
      setMessage('You’re on the list. We’ll be in touch when there’s news.');
      form.reset();
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  }

  if (state === 'success') {
    return (
      <div className={s.success} role="status">
        <span className={s.successIcon}><Check aria-hidden="true" /></span>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={handleSubmit}>
      <FieldGroup className={s.fieldGroup}>
        <Field>
          <FieldLabel className={s.fieldLabel} htmlFor="waitlist-email">Email address</FieldLabel>
          <div className={s.inputRow}>
            <Input className={s.emailInput} id="waitlist-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} disabled={state === 'submitting'} />
            <Button className={s.submit} type="submit" disabled={state === 'submitting'}>
              {state === 'submitting' ? <LoaderCircle className={s.spinner} aria-hidden="true" /> : <>Request an invite <ArrowRight data-icon="inline-end" aria-hidden="true" /></>}
            </Button>
          </div>
        </Field>
        <Field orientation="horizontal" className={s.consentField}>
          <input className={s.checkbox} id="waitlist-consent" name="consent" type="checkbox" required disabled={state === 'submitting'} />
          <div className={s.consentCopy}>
            <FieldLabel htmlFor="waitlist-consent">Email me occasional early-access updates.</FieldLabel>
            <FieldDescription className={s.consentDescription}>We use your email only for Crease updates. No tracking pixels or list sharing.</FieldDescription>
          </div>
        </Field>
      </FieldGroup>
      <p className={`${s.message} ${state === 'error' ? s.error : ''}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
