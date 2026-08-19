import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const tileSizes = { sm: 'h-7 w-7 text-sm', md: 'h-9 w-9 text-lg', lg: 'h-11 w-11 text-xl' };
const textSizes = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' };

/** Logo tipográfico de Gasti (marca + wordmark). */
export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground',
          tileSizes[size],
        )}
        aria-hidden
      >
        G
      </span>
      {showText && (
        <span className={cn('font-bold tracking-tight text-foreground', textSizes[size])}>
          Gasti
        </span>
      )}
    </span>
  );
}
