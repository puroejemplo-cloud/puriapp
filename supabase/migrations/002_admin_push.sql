-- =============================================
-- MIGRACIÓN 002: Suscripciones push para admins
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================

CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purificadora_id uuid NOT NULL REFERENCES purificadoras(id) ON DELETE CASCADE,
  endpoint        text UNIQUE NOT NULL,
  p256dh          text NOT NULL,
  auth            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_push_purificadora ON admin_push_subscriptions(purificadora_id);
CREATE INDEX IF NOT EXISTS idx_admin_push_user        ON admin_push_subscriptions(user_id);
