type IconName = 'arrow' | 'code' | 'layers' | 'book' | 'check' | 'repeat';

const paths: Record<IconName, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',
  layers: 'm12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
  book: 'M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-2-1-6-2-10 1Z',
  check: 'm5 12 4 4L19 6',
  repeat:
    'M20 7H7a5 5 0 0 0-5 5m18-5-4-4m4 4-4 4M4 17h13a5 5 0 0 0 5-5M4 17l4 4m-4-4 4-4',
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
