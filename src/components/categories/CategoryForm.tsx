import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { categorySchema, type CategoryInput } from '@/lib/validations';
import { COLOR_OPTIONS, ICON_OPTIONS, getIconComponent } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { Category, TransactionType } from '@/types/models';

interface CategoryFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CategoryInput) => Promise<void>;
  initial?: Category | null;
  defaultType?: TransactionType;
}

export function CategoryForm({
  open,
  onClose,
  onSubmit,
  initial,
  defaultType = 'EXPENSE',
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: defaultType, icon: 'circle', color: COLOR_OPTIONS[0] },
  });

  const type = watch('type');
  const icon = watch('icon');
  const color = watch('color');

  useEffect(() => {
    if (!open) return;
    reset({
      name: initial?.name ?? '',
      type: initial?.type ?? defaultType,
      icon: initial?.icon ?? 'circle',
      color: initial?.color ?? COLOR_OPTIONS[0],
    });
  }, [open, initial, defaultType, reset]);

  const submit = async (values: CategoryInput) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar categoría' : 'Nueva categoría'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-2">
          {(['EXPENSE', 'INCOME'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('type', value)}
              className={cn(
                'rounded-[var(--radius)] border p-2.5 text-sm font-medium transition-colors',
                type === value
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {value === 'EXPENSE' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>

        <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            placeholder="Ej. Restaurantes"
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </Field>

        <Field label="Color" error={errors.color?.message}>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c)}
                aria-label={`Color ${c}`}
                className={cn(
                  'h-7 w-7 rounded-full ring-offset-2 ring-offset-card transition',
                  color === c ? 'ring-2 ring-foreground' : '',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <Field label="Icono" error={errors.icon?.message}>
          <div className="grid grid-cols-8 gap-2">
            {ICON_OPTIONS.map((name) => {
              const Icon = getIconComponent(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setValue('icon', name)}
                  aria-label={`Icono ${name}`}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-md border transition-colors',
                    icon === name
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {initial ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
