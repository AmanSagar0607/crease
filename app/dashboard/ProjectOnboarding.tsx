'use client';

import { useState } from 'react';
import styles from './onboarding.module.css';

type Method = 'script' | 'npm' | 'wordpress' | 'shopify';
type Props = {
  name: string;
  domain: string;
  projectId: string;
  writeKey: string;
  origin: string;
  endpoint: string;
  verified: boolean;
  verification: { record: string; dns_name?: string } | null;
  checking: boolean;
  notice: string;
  eventReceived: boolean;
  eventChecking: boolean;
  eventNotice: string;
  onVerify: () => void;
  onCheckEvents: () => void;
  onFinish: () => void;
};

export default function ProjectOnboarding(props: Props) {
  const [step, setStep] = useState<'verify' | 'install' | 'events'>('verify');
  const [method, setMethod] = useState<Method>('script');
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  const snippet = `<script>\n  // Dispatch crease:consent after any required consent has been granted.\n  window.addEventListener('crease:consent', function () {\n    var script = document.createElement('script');\n    script.src = ${JSON.stringify(props.origin + '/crease.js')};\n    script.onload = function () {\n      window.crease.init({\n        projectId: ${JSON.stringify(props.projectId)},\n        writeKey: ${JSON.stringify(props.writeKey)},\n        endpoint: ${JSON.stringify(props.endpoint)}\n      });\n    };\n    document.head.appendChild(script);\n  }, { once: true });\n</script>`;
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); setCopyError(''); }
    catch { setCopyError('Could not copy automatically. Select and copy the text instead.'); }
  }
  const steps = [ ['verify', 'Verify domain'], ['install', 'Install tracker'], ['events', 'First event'] ] as const;
  return (
    <div className={styles.page}>
      <header className={styles.header}><span className={styles.brand}><span>✳</span> crease.</span><button type="button" className={styles.exit} onClick={props.onFinish}>Go to dashboard <span aria-hidden="true">↗</span></button></header>
      <main className={styles.main}>
        <div className={styles.intro}><span className={styles.eyebrow}>YOUR SITE, CONNECTED</span><h1>Let’s get {props.name} set up.</h1><p>Connect <strong>{props.domain}</strong> to Crease in a few simple steps.</p></div>
        <nav className={styles.steps} aria-label="Setup steps">{steps.map(([id, label], index) => <button key={id} type="button" aria-current={step === id ? 'step' : undefined} onClick={() => setStep(id)}><span className={styles.stepNumber} data-complete={(index === 0 && props.verified) || (index === 2 && props.eventReceived) ? 'true' : undefined}>{(index === 0 && props.verified) || (index === 2 && props.eventReceived) ? '✓' : `0${index + 1}`}</span><span>{label}</span></button>)}</nav>
        <section className={styles.card}>
          {step === 'verify' && <>
            <div className={styles.cardHead}><div><span className={styles.kicker}>STEP 01 / OWNERSHIP</span><h2>Verify your domain</h2><p>Prove you control this site before Crease accepts events. Add this TXT record at your DNS provider.</p></div><span className={styles.status} data-ready={props.verified}>{props.verified ? 'Verified' : 'Not verified'}</span></div>
            {props.verification ? <div className={styles.records}><div><span>TYPE</span><strong>TXT</strong></div><div><span>NAME / HOST</span><code>{props.verification.dns_name || `_crease-verification.${props.domain}`}</code><button type="button" onClick={() => void copy(props.verification?.dns_name || `_crease-verification.${props.domain}`, 'name')}>{copied === 'name' ? 'Copied' : 'Copy'}</button></div><div><span>VALUE / CONTENT</span><code>{props.verification.record}</code><button type="button" onClick={() => void copy(props.verification!.record, 'record')}>{copied === 'record' ? 'Copied' : 'Copy'}</button></div></div> : <p className={styles.note}>Loading your verification record…</p>}
            <p className={styles.note}>DNS updates can take a little while. Existing records at the domain root also work.</p>
            {copyError && <p className={styles.message} role="status">{copyError}</p>}
            {props.notice && <p className={styles.message} role="status">{props.notice}</p>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={props.onVerify} disabled={props.checking || props.verified}>{props.checking ? 'Checking…' : props.verified ? 'Domain verified' : 'Check verification'}</button><button className={styles.primary} type="button" onClick={() => setStep('install')}>Continue to installation <span>→</span></button></div>
          </>}
          {step === 'install' && <>
            <div className={styles.cardHead}><div><span className={styles.kicker}>STEP 02 / INSTALLATION</span><h2>Add the tracker</h2><p>Choose how your site is built, then add the Crease script after any required visitor consent.</p></div></div>
            <div className={styles.tabs} role="group" aria-label="Installation method">{([['script','Website'],['npm','npm'],['wordpress','WordPress'],['shopify','Shopify']] as const).map(([id,label]) => <button key={id} type="button" aria-pressed={method === id} onClick={() => setMethod(id)}>{label}</button>)}</div>
            {method === 'npm' ? <p className={styles.instructions}>The Crease npm package is not published yet. Use the Website script to install Crease today.</p> : <>
            <p className={styles.instructions}>{method === 'script' ? 'Add this code to your site’s shared page template, before the closing head tag.' : method === 'wordpress' ? 'Add this code to your active theme’s shared head using a child theme or a trusted header-insertion plugin.' : 'Add this code to your published theme’s layout file, before the closing head tag.'}</p>
            <div className={styles.codeWrap}><button type="button" onClick={() => void copy(snippet, 'script')} disabled={!props.writeKey}>{copied === 'script' ? 'Copied' : 'Copy code'}</button><pre tabIndex={0}><code>{props.writeKey ? snippet : 'Write key unavailable in this browser. Open Installation in the dashboard to generate one.'}</code></pre></div>
            <p className={styles.note}>After this code has run, dispatch <code>window.dispatchEvent(new Event('crease:consent'))</code> when consent is granted. On every later page load, dispatch it again after this listener is registered if your consent manager confirms consent is still valid. The write key is included in your public site code.</p>
            </>}
            {copyError && <p className={styles.message} role="status">{copyError}</p>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => setStep('verify')}>← Back</button>{method === 'npm' ? <button className={styles.primary} type="button" onClick={() => setMethod('script')}>Use the website script</button> : <button className={styles.primary} type="button" onClick={() => { setStep('events'); props.onCheckEvents(); }}>I’ve added the code <span>→</span></button>}</div>
          </>}
          {step === 'events' && <>
            <div className={styles.cardHead}><div><span className={styles.kicker}>STEP 03 / FIRST EVENT</span><h2>{props.eventReceived ? 'Your site is connected.' : 'Waiting for your first event'}</h2><p>{props.eventReceived ? 'Crease has received an event from this project.' : 'Publish your changes, grant any required consent, then visit your website to send a page view.'}</p></div><span className={styles.status} data-ready={props.eventReceived}>{props.eventReceived ? 'Receiving events' : 'Waiting'}</span></div>
            <div className={styles.checklist}><div><span>01</span><p>Confirm <strong>{props.domain}</strong> is verified.</p></div><div><span>02</span><p>Publish the tracker to your live site.</p></div><div><span>03</span><p>Visit your site after granting any required consent.</p></div></div>
            {props.eventNotice && <p className={styles.message} role="status">{props.eventNotice}</p>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => setStep('install')}>← Installation</button><button className={styles.secondary} type="button" onClick={props.onCheckEvents} disabled={props.eventChecking}>{props.eventChecking ? 'Checking…' : 'Check for events'}</button><button className={styles.primary} type="button" onClick={props.onFinish}>Open dashboard <span>→</span></button></div>
          </>}
        </section>
        <p className={styles.help}>Need a hand? <a href="/docs">Read the installation guide ↗</a></p>
      </main>
      <div className={styles.footer}><span>CREASE / SETUP</span><span>MADE FOR THE THINGS YOU MAKE</span></div>
    </div>
  );
}
