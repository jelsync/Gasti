import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '@/services/categories.service';
import { mapDbError } from '@/lib/errors';
import type { Category } from '@/types/models';
import type { CategoryInput } from '@/lib/validations';

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCategories(await getCategories());
    } catch (e) {
      setError(mapDbError(e, 'No se pudieron cargar las categorías.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CategoryInput) => {
      if (!user) throw new Error('Sesión no válida');
      await createCategory(user.id, input);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, input: CategoryInput) => {
      await updateCategory(id, input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCategory(id);
      await refresh();
    },
    [refresh],
  );

  return { categories, loading, error, refresh, create, update, remove };
}
