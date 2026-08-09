interface CalendarLogoProps {
  className?: string;
  size?: number;
}

export function CalendarLogo({ className = 'size-8', size }: CalendarLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="#B2622D" />
      <rect x="7" y="9" width="18" height="16" rx="2" fill="none" stroke="#F8FAFC" strokeWidth="2" />
      <line x1="7" y1="14" x2="25" y2="14" stroke="#F8FAFC" strokeWidth="2" />
      <line x1="11" y1="6" x2="11" y2="11" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="6" x2="21" y2="11" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" />
      <rect x="11" y="17" width="4" height="4" fill="#F8FAFC" />
    </svg>
  );
}
