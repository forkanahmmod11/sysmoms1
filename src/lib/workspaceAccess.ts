import { supabase } from '@/lib/auth';
import { getUserRequest, type SubscriptionRequest } from '@/lib/subscription';

export type WorkspaceAccess = {
  onboardingComplete: boolean;
  subscription: SubscriptionRequest | null;
  fullAccess: boolean;
};

export async function getWorkspaceAccess(userId: string): Promise<WorkspaceAccess> {
  if (!supabase) return { onboardingComplete: false, subscription: null, fullAccess: false };
  const [{ data: onboarding }, subscription] = await Promise.all([
    supabase.from('workspace_onboarding').select('user_id').eq('user_id', userId).maybeSingle(),
    getUserRequest(userId),
  ]);
  return { onboardingComplete: !!onboarding, subscription, fullAccess: subscription?.status === 'approved' };
}
