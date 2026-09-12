import { Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '@/contexts/privacy';
import { cn } from '@/lib/utils';

export const HIDDEN_AMOUNT = '••••••';

export function PrivacyToggle({
  privacyKey,
  className,
}: {
  privacyKey: string;
  className?: string;
}) {
  const { isHidden, toggle } = usePrivacy();
  const hidden = isHidden(privacyKey);
  const Icon = hidden ? Eye : EyeOff;

  return (
    <button
      type="button"
      aria-label={hidden ? 'Mostrar monto' : 'Ocultar monto'}
      title={hidden ? 'Mostrar monto' : 'Ocultar monto'}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(privacyKey);
      }}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
