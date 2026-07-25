type Props = {
  className?: string;
  size?: number;
};

export function LogoMark({ className = "logo-mark", size = 48 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <radialGradient id="bubble-a" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#b8cdb9" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6f8f72" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id="bubble-b" cx="65%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#c4b8d4" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#8a78a8" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="membrane" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6f8f72" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#8a78a8" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="24" r="13.5" fill="url(#bubble-a)" />
      <circle cx="30" cy="24" r="13.5" fill="url(#bubble-b)" />
      <path
        d="M24 10.5c-1.2 2.8-1.8 5.8-1.8 8.8s.6 6 1.8 8.8c1.2-2.8 1.8-5.8 1.8-8.8s-.6-6-1.8-8.8z"
        fill="url(#membrane)"
      />
      <ellipse cx="15" cy="18" rx="4.5" ry="2.5" fill="#ffffff" fillOpacity="0.85" />
      <ellipse cx="33" cy="18" rx="4.5" ry="2.5" fill="#ffffff" fillOpacity="0.85" />
      <circle
        cx="18"
        cy="24"
        r="13.5"
        stroke="#6f8f72"
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />
      <circle
        cx="30"
        cy="24"
        r="13.5"
        stroke="#8a78a8"
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />
    </svg>
  );
}
