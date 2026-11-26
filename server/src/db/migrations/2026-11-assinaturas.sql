-- Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
-- Assinaturas dos planos pagos (Stripe) em users, para um banco JÁ EXISTENTE.
-- Cole no phpMyAdmin (aba SQL) ou rode no cliente mysql. "npm run migrate" faz o mesmo (idempotente).
-- Roda uma vez só: se uma coluna ou o índice já existir, o servidor avisa (erro 1060 / 1061) e basta pular o comando.

ALTER TABLE users
  ADD COLUMN subscription_period    VARCHAR(10)  NULL COMMENT 'mensal, semestral ou anual',
  ADD COLUMN subscription_status    VARCHAR(20)  NULL COMMENT 'pending, active, canceled, payment_failed ou ended',
  ADD COLUMN subscription_active    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'No período pago',
  ADD COLUMN last_payment_at        DATETIME(3)  NULL COMMENT 'Data do último pagamento',
  ADD COLUMN next_payment_at        DATETIME(3)  NULL COMMENT 'Data do próximo pagamento (fim do período pago)',
  ADD COLUMN stripe_customer_id     VARCHAR(255) NULL,
  ADD COLUMN stripe_subscription_id VARCHAR(255) NULL;

ALTER TABLE users ADD KEY ix_users_stripe_subscription (stripe_subscription_id);
