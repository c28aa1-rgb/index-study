export function ChatGPTMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.35 16.1 5.7v4.7L12 12.75l-4.1-2.36v-4.7L12 3.35Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="m16.1 5.7 3.95 2.3v4.72l-4.05 2.34-4-2.31" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="m16 14.99.02 4.57-4.02 2.32-4.1-2.36v-4.68" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="m7.9 5.7-3.95 2.3v4.72L8 15.06l4-2.31" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="m8 14.99-.02 4.57L12 21.88" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="m12 12.75-.02 4.72" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  )
}
