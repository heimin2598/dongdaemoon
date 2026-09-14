import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { DEFAULT_ENTITLEMENT, isActivePremium, subscribeEntitlement } from '@/lib/entitlement';
import { Entitlement } from '@/types';

interface EntitlementState {
  isPremium: boolean;
  entitlement: Entitlement;
  loading: boolean;
}

export function useEntitlement(): EntitlementState {
  const user = useAuthStore((s) => s.user);
  const [entitlement, setEntitlement] = useState<Entitlement>(DEFAULT_ENTITLEMENT);
  const [loading, setLoading] = useState<boolean>(!!user);

  useEffect(() => {
    if (!user) {
      setEntitlement(DEFAULT_ENTITLEMENT);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeEntitlement(user.id, (e) => {
      setEntitlement(e);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.id]);

  return {
    isPremium: isActivePremium(entitlement),
    entitlement,
    loading,
  };
}
