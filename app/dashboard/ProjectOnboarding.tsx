'use client';

import { useState } from 'react';
import styles from './onboarding.module.css';

type Method = 'script' | 'npm' | 'wordpress' | 'shopify' | 'agent';
type NpmTarget = 'next' | 'javascript';
type AgentTarget = 'codex' | 'claude' | 'other';
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
  const [npmTarget, setNpmTarget] = useState<NpmTarget>('next');
  const [agentTarget, setAgentTarget] = useState<AgentTarget>('codex');
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  const snippet = `<script>\n  // Dispatch Zappa:consent after any required consent has been granted.\n  window.addEventListener('Zappa:consent', function () {\n    var script = document.createElement('script');\n    script.src = ${JSON.stringify(props.origin + '/Zappa.js')};\n    script.onload = function () {\n      window.Zappa.init({\n        projectId: ${JSON.stringify(props.projectId)},\n        writeKey: ${JSON.stringify(props.writeKey)},\n        endpoint: ${JSON.stringify(props.endpoint)}\n      });\n    };\n    document.head.appendChild(script);\n  }, { once: true });\n</script>`;
  const npmInstallCommand = 'npm install @aman-sagar06077/zappa-analytics';
  const npmEnvSnippet = `NEXT_PUBLIC_ZAPPA_PROJECT_ID=${props.projectId}\nNEXT_PUBLIC_ZAPPA_WRITE_KEY=${props.writeKey}\nNEXT_PUBLIC_ZAPPA_ORIGIN=${props.origin || 'https://www.zappa.in'}`;
  const npmSnippet = npmTarget === 'next'
    ? `import { Analytics } from '@aman-sagar06077/zappa-analytics/next';\n\n// Add inside your root layout's <body>\n<Analytics\n  projectId={process.env.NEXT_PUBLIC_ZAPPA_PROJECT_ID!}\n  writeKey={process.env.NEXT_PUBLIC_ZAPPA_WRITE_KEY!}\n  endpoint={process.env.NEXT_PUBLIC_ZAPPA_ORIGIN + '/api/events'}\n/>`
    : `import { init } from '@aman-sagar06077/zappa-analytics';\n\nconst analytics = init({\n  projectId: ${JSON.stringify(props.projectId)},\n  writeKey: ${JSON.stringify(props.writeKey)},\n  endpoint: ${JSON.stringify(props.endpoint)}\n});\n\nanalytics.track('signup_completed', { plan: 1 });`;
  const agentNames: Record<AgentTarget, string> = { codex: 'Codex', claude: 'Claude Code', other: 'AI coding agent' };
  const agentPrompt = `Set up Zappa analytics in this repository for the website ${props.domain} (project: ${props.name}).

Install the published package using the repository's existing package manager:
${npmInstallCommand}

Add these values to the local environment file used by this app, and tell me where to add them in production hosting settings:
${npmEnvSnippet}

Inspect the framework and router before editing. For Next.js App Router, import Analytics from '@aman-sagar06077/zappa-analytics/next' and render it inside the root layout's <body>. For other setups, use the package's documented browser initialization API. Preserve any existing analytics consent flow: initialize only after consent when consent is required. Avoid duplicate tracker instances and don't add unrelated tracking or collect personal data.

Make the smallest changes needed, then run the relevant typecheck or build if available. Report the files changed and how I can verify the first event. Do not deploy or commit/push.`;
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); setCopyError(''); }
    catch { setCopyError('Could not copy automatically. Select and copy the text instead.'); }
  }
  const steps = [ ['verify', 'Verify domain'], ['install', 'Install tracker'], ['events', 'First event'] ] as const;
  return (
    <div className={styles.page}>
      <header className={styles.header}><span className={styles.brand}><span>?</span> Zappa.</span><button type="button" className={styles.exit} onClick={props.onFinish}>Go to dashboard <span aria-hidden="true">?</span></button></header>
      <main className={styles.main}>
        <div className={styles.intro}><span className={styles.eyebrow}>YOUR SITE, CONNECTED</span><h1>Let’s get {props.name} set up.</h1><p>Connect <strong>{props.domain}</strong> to Zappa in a few simple steps.</p></div>
        <nav className={styles.steps} aria-label="Setup steps">{steps.map(([id, label], index) => <button key={id} type="button" aria-current={step === id ? 'step' : undefined} onClick={() => setStep(id)}><span className={styles.stepNumber} data-complete={(index === 0 && props.verified) || (index === 2 && props.eventReceived) ? 'true' : undefined}>{(index === 0 && props.verified) || (index === 2 && props.eventReceived) ? '?' : `0${index + 1}`}</span><span>{label}</span></button>)}</nav>
        <section className={styles.card}>
          {step === 'verify' && <>
            <div className={styles.cardHead}><div><span className={styles.kicker}>STEP 01 / OWNERSHIP</span><h2>Verify your domain</h2><p>Prove you control this site before Zappa accepts events. Add this TXT record at your DNS provider.</p></div><span className={styles.status} data-ready={props.verified}>{props.verified ? 'Verified' : 'Not verified'}</span></div>
            {props.verification ? <div className={styles.records}><div><span>TYPE</span><strong>TXT</strong></div><div><span>NAME / HOST</span><code>{props.verification.dns_name || `_Zappa-verification.${props.domain}`}</code><button type="button" onClick={() => void copy(props.verification?.dns_name || `_Zappa-verification.${props.domain}`, 'name')}>{copied === 'name' ? 'Copied' : 'Copy'}</button></div><div><span>VALUE / CONTENT</span><code>{props.verification.record}</code><button type="button" onClick={() => void copy(props.verification!.record, 'record')}>{copied === 'record' ? 'Copied' : 'Copy'}</button></div></div> : <p className={styles.note}>Loading your verification record…</p>}
            <p className={styles.note}>DNS updates can take a little while. Existing records at the domain root also work.</p>
            {copyError && <p className={styles.message} role="status">{copyError}</p>}
            {props.notice && <p className={styles.message} role="status">{props.notice}</p>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={props.onVerify} disabled={props.checking || props.verified}>{props.checking ? 'Checking…' : props.verified ? 'Domain verified' : 'Check verification'}</button><button className={styles.primary} type="button" onClick={() => setStep('install')}>Continue to installation <span>?</span></button></div>
          </>}
          {step === 'install' && <>
            <div className={styles.cardHead}><div><span className={styles.kicker}>STEP 02 / INSTALLATION</span><h2>Add the tracker</h2><p>Choose how your site is built, then add the Zappa script after any required visitor consent.</p></div></div>
            <div className={styles.tabs} role="group" aria-label="Installation method">{([['script','Website'],['npm','npm'],['wordpress','WordPress'],['shopify','Shopify'],['agent','AI agent']] as const).map(([id,label]) => <button key={id} type="button" aria-pressed={method === id} onClick={() => setMethod(id)}>{label}</button>)}</div>
            {method === 'agent' ? <div className={styles.npmGuide}>
              <div className={styles.npmGuideHead}><div><span className={styles.kicker}>LET YOUR CODING AGENT SET IT UP</span><h3>Copy a ready-to-run setup prompt.</h3></div></div>
              <p className={styles.instructions}>Choose your agent, then paste the prompt into your coding session with this website’s codebase open. It includes the project’s install details and setup values.</p>
              <div className={styles.npmTargets} role="group" aria-label="AI coding agent">
                {([['codex','Codex'],['claude','Claude Code'],['other','Other']] as const).map(([id,label]) => <button key={id} type="button" aria-pressed={agentTarget === id} onClick={() => setAgentTarget(id)}>{label}</button>)}
              </div>
              <div className={styles.codeWrap}><button type="button" onClick={() => void copy(agentPrompt, `agent-${agentTarget}`)} disabled={!props.writeKey}>{copied === `agent-${agentTarget}` ? 'Copied' : `Copy ${agentNames[agentTarget]} prompt`}</button><pre tabIndex={0}><code>{props.writeKey ? agentPrompt : 'Write key unavailable. Open Installation in the dashboard to generate one.'}</code></pre></div>
              <p className={styles.note}>The prompt asks your agent to inspect the app before choosing an integration, preserve consent handling, and show you the changes. Your project write key is included as public browser configuration.</p>
              {!props.writeKey && <p className={styles.message} role="status">Generate a write key before copying the setup prompt.</p>}
            </div> : method === 'npm' ? <div className={styles.npmGuide}>
              <div className={styles.npmGuideHead}>
                <div><span className={styles.kicker}>NO EXTRA CONNECTION STEP</span><h3>Install, paste, start tracking.</h3></div>
                <button className={styles.copyAction} type="button" onClick={() => void copy(npmInstallCommand, 'npm-install')}>{copied === 'npm-install' ? 'Copied' : 'Copy install command'}</button>
              </div>
              <div className={styles.command}><code>{npmInstallCommand}</code></div>
              {npmTarget === 'next' && <section className={styles.envGuide} aria-label="Next.js environment variables">
                <div className={styles.envGuideHead}><div><strong>1. Add to <code>.env.local</code></strong><span>These values are generated for {props.name}.</span></div><button type="button" onClick={() => void copy(npmEnvSnippet, 'npm-env')} disabled={!props.writeKey}>{copied === 'npm-env' ? 'Copied' : 'Copy env vars'}</button></div>
                <pre className={styles.envCode} tabIndex={0}><code>{props.writeKey ? npmEnvSnippet : 'Generate a project write key to prepare these values.'}</code></pre>
                <p className={styles.note}>For production, add the same values in your hosting provider’s environment settings. These <code>NEXT_PUBLIC_</code> values are public browser config; the write key scopes events to this project and is not a secret.</p>
              </section>}
              <div className={styles.npmTargets} role="group" aria-label="Package setup target">
                <button type="button" aria-pressed={npmTarget === 'next'} onClick={() => setNpmTarget('next')}>Next.js</button>
                <button type="button" aria-pressed={npmTarget === 'javascript'} onClick={() => setNpmTarget('javascript')}>JavaScript</button>
              </div>
              <p className={styles.instructions}>{npmTarget === 'next' ? '2. Add this component inside your root layout’s <body>. It sends page views automatically.' : 'Add this initialization to your app entry point. Page views and custom events send automatically.'}</p>
              <div className={styles.codeWrap}><button type="button" onClick={() => void copy(npmSnippet, 'npm-code')} disabled={!props.writeKey}>{copied === 'npm-code' ? 'Copied' : 'Copy setup code'}</button><pre tabIndex={0}><code>{props.writeKey ? npmSnippet : 'Write key unavailable. Open the dashboard Installation page to generate one.'}</code></pre></div>
              <p className={styles.note}>Project ID, write key, and collector URL are filled in for this site. If your site requires analytics consent, only render or initialize this package after consent is granted.</p>
              <p className={styles.docsLink}><a href="/docs">Open full setup guide</a></p>
              {copyError && <p className={styles.message} role="status">{copyError}</p>}
            </div> : <>
            <p className={styles.instructions}>{method === 'script' ? 'Add this code to your site’s shared page template, before the closing head tag.' : method === 'wordpress' ? 'Add this code to your active theme’s shared head using a child theme or a trusted header-insertion plugin.' : 'Add this code to your published theme’s layout file, before the closing head tag.'}</p>
            <div className={styles.codeWrap}><button type="button" onClick={() => void copy(snippet, 'script')} disabled={!props.writeKey}>{copied === 'script' ? 'Copied' : 'Copy code'}</button><pre tabIndex={0}><code>{props.writeKey ? snippet : 'Write key unavailable in this browser. Open Installation in the dashboard to generate one.'}</code></pre></div>
            <p className={styles.note}>After this code has run, dispatch <code>window.dispatchEvent(new Event('Zappa:consent'))</code> when consent is granted. On every later page load, dispatch it again after this listener is registered if your consent manager confirms consent is still valid. The write key is included in your public site code.</p>
            </>}
            {copyError && <p className={styles.message} role="status">{copyError}</p>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => setStep('verify')}>? Back</button><button className={styles.primary} type="button" onClick={() => { setStep('events'); props.onCheckEvents(); }}>{method === 'npm' ? 'I’ve installed the package' : method === 'agent' ? 'I’ve finished setup' : 'I’ve added the code'} <span>?</span></button></div>
          </>}
          {step === 'events' && <>
            <div className={styles.cardHead}><div><span className={styles.kicker}>STEP 03 / FIRST EVENT</span><h2>{props.eventReceived ? 'Your site is connected.' : 'Waiting for your first event'}</h2><p>{props.eventReceived ? 'Zappa has received an event from this project.' : 'Publish your changes, grant any required consent, then visit your website to send a page view.'}</p></div><span className={styles.status} data-ready={props.eventReceived}>{props.eventReceived ? 'Receiving events' : 'Waiting'}</span></div>
            <div className={styles.checklist}><div><span>01</span><p>Confirm <strong>{props.domain}</strong> is verified.</p></div><div><span>02</span><p>Publish the tracker to your live site.</p></div><div><span>03</span><p>Visit your site after granting any required consent.</p></div></div>
            {props.eventNotice && <p className={styles.message} role="status">{props.eventNotice}</p>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => setStep('install')}>? Installation</button><button className={styles.secondary} type="button" onClick={props.onCheckEvents} disabled={props.eventChecking}>{props.eventChecking ? 'Checking…' : 'Check for events'}</button><button className={styles.primary} type="button" onClick={props.onFinish}>Open dashboard <span>?</span></button></div>
          </>}
        </section>
        <p className={styles.help}>Need a hand? <a href="/docs">Read the installation guide ?</a></p>
      </main>
      <div className={styles.footer}><span>ZAPPA / SETUP</span><span>MADE FOR THE THINGS YOU MAKE</span></div>
    </div>
  );
}
