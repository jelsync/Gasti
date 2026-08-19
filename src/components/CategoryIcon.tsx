import { getIconComponent } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const boxSizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' } as const;
const iconSizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' } as const;

/** Icono de categoría con fondo tenue del color de la categoría. */
export function CategoryIcon({ icon, color, size = 'md', className }: CategoryIconProps) {
  const Icon = getIconComponent(icon);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        boxSizes[size],
        className,
      )}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Icon className={iconSizes[size]} aria-hidden />
    </span>
  );
}
