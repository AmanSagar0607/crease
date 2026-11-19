import styles from './dashboard.module.css';

/** Domain ownership status, rendered only when verification succeeds. */
export default function VerifiedBadge() {
  return (
    <svg className={styles.verifiedIcon} viewBox="0 0 24 24" role="img" aria-label="Domain verified" xmlns="http://www.w3.org/2000/svg">
      <title>Domain verified</title>
      <g fill="#1D9BF0">
        <circle cx="12" cy="12" r="8.3" />
        {Array.from({ length: 12 }, (_, index) => {
          const angle = index * Math.PI / 6;
          return <circle key={index} cx={12 + 8 * Math.cos(angle)} cy={12 + 8 * Math.sin(angle)} r="2.15" />;
        })}
      </g>
      <path d="m8 12.1 2.6 2.7 5.5-5.7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
