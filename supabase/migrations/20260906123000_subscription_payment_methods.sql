-- Subscription payment workflow: bKash, Upay and Citytouch.
ALTER TABLE public.subscription_requests
  ADD COLUMN IF NOT EXISTS payment_method text;

-- Keep only currently supported methods when a value is provided.
ALTER TABLE public.subscription_requests
  DROP CONSTRAINT IF EXISTS subscription_requests_payment_method_check;

ALTER TABLE public.subscription_requests
  ADD CONSTRAINT subscription_requests_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('bkash','upay','citytouch'));
