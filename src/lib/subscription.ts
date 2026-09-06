import { supabase } from '@/lib/auth';

export type Plan = {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  description: string;
  features: string[];
  sort_order: number;
};

export type SubscriptionRequest = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  plan_id: string;
  plan_name: string;
  organization_name: string;
  status: 'pending' | 'approved' | 'rejected';
  document_urls: string[];
  screenshot_urls: string[];
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
};

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    billing_period: 'monthly',
    description: 'Perfect for small teams getting started with office management.',
    features: ['Up to 5 team members', 'Task management', 'Project tracking', 'Basic scheduling', 'Team messaging'],
    sort_order: 1,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 49,
    billing_period: 'monthly',
    description: 'For growing teams that need more power and collaboration.',
    features: ['Up to 50 team members', 'Everything in Starter', 'Advanced analytics', 'Transaction tracking', 'Custom roles', 'Priority support'],
    sort_order: 2,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    billing_period: 'monthly',
    description: 'For large organizations with advanced security and compliance needs.',
    features: ['Unlimited team members', 'Everything in Professional', 'Dedicated subdomain', 'SSO authentication', 'Audit logs', 'Custom integrations', '24/7 support'],
    sort_order: 3,
  },
];

const STORAGE_KEY = 'sysmobyte_subscription_requests';

function getLocalRequests(): SubscriptionRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRequests(requests: SubscriptionRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

export async function getUserRequest(userId: string): Promise<SubscriptionRequest | null> {
  if (supabase) {
    const { data } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as SubscriptionRequest;
  }
  const local = getLocalRequests().find((r) => r.user_id === userId);
  return local || null;
}

export async function getAllRequests(): Promise<SubscriptionRequest[]> {
  if (supabase) {
    const { data } = await supabase
      .from('subscription_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && data.length > 0) return data as SubscriptionRequest[];
  }
  return getLocalRequests();
}

export async function submitRequest(params: {
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  organizationName: string;
  documentUrls: string[];
  screenshotUrls: string[];
}): Promise<SubscriptionRequest> {
  const request: SubscriptionRequest = {
    id: crypto.randomUUID(),
    user_id: params.userId,
    user_email: params.userEmail,
    user_name: params.userName,
    plan_id: params.planId,
    plan_name: params.planName,
    organization_name: params.organizationName,
    status: 'pending',
    document_urls: params.documentUrls,
    screenshot_urls: params.screenshotUrls,
    admin_notes: null,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase.from('subscription_requests').insert({
      user_id: params.userId,
      plan_id: params.planId,
      organization_name: params.organizationName,
      document_urls: params.documentUrls,
      screenshot_urls: params.screenshotUrls,
    }).select('*').maybeSingle();
    if (!error && data) return data as SubscriptionRequest;
  }

  const local = getLocalRequests();
  local.unshift(request);
  saveLocalRequests(local);
  return request;
}

export async function approveRequest(requestId: string, adminId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.rpc('approve_subscription_request', { req_id: requestId });
    if (!error) return;
  }
  const local = getLocalRequests();
  const req = local.find((r) => r.id === requestId);
  if (req) {
    req.status = 'approved';
    req.reviewed_at = new Date().toISOString();
    req.admin_notes = req.admin_notes || 'Approved by admin';
    saveLocalRequests(local);
  }
}

export async function rejectRequest(requestId: string, adminId: string, notes: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('subscription_requests')
      .update({ status: 'rejected', admin_notes: notes, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', requestId);
    if (!error) return;
  }
  const local = getLocalRequests();
  const req = local.find((r) => r.id === requestId);
  if (req) {
    req.status = 'rejected';
    req.admin_notes = notes;
    req.reviewed_at = new Date().toISOString();
    saveLocalRequests(local);
  }
}

export async function uploadFile(userId: string, file: File): Promise<string> {
  if (supabase) {
    const ext = file.name.split('.').pop() || 'file';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('subscription-docs').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('subscription-docs').getPublicUrl(path);
      return data.publicUrl;
    }
  }
  return URL.createObjectURL(file);
}
