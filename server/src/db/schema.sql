-- Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
-- Esquema para MySQL 8+ / MariaDB 10.6+. Aplique com: npm run migrate

-- Administradores do sistema (o e-mail é o login). Não são expostos por nenhuma rota da API.
-- ATENÇÃO: password_hash guarda SHA-256 em hexadecimal (64 caracteres), a pedido do projeto. SHA-256 simples,
-- sem sal, é fraco contra força bruta e tabelas prontas; o recomendado é scrypt (como em users) ou argon2.
CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL COMMENT 'Nome do Administrador',
  email         VARCHAR(200) NOT NULL COMMENT 'E-mail (login do administrador)',
  password_hash VARCHAR(64)  NOT NULL COMMENT 'SHA-256 em hexadecimal (fraco: prefira scrypt)',
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grupos (planos) de usuários, com os limites de cada um. Os limites ainda não são aplicados pela API.
CREATE TABLE IF NOT EXISTS users_groups (
  id                         INT UNSIGNED       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                       VARCHAR(20)        NOT NULL COMMENT 'Nome do grupo',
  max_files                  MEDIUMINT UNSIGNED NOT NULL COMMENT 'Máximo de arquivos',
  max_size_mb                MEDIUMINT UNSIGNED NOT NULL COMMENT 'Espaço máximo (MB)',
  waiting_time_for_deletion  SMALLINT UNSIGNED  NOT NULL DEFAULT 30 COMMENT 'Dias de espera para excluir',
  monthly_amount             DECIMAL(5,2)       NOT NULL DEFAULT 0.00 COMMENT 'Valor mensal',
  semestral                  DECIMAL(5,2)       NOT NULL DEFAULT 0.00 COMMENT 'Valor semestral',
  annual_value               DECIMAL(5,2)       NOT NULL DEFAULT 0.00 COMMENT 'Valor anual',
  visible_to_the_user        TINYINT(1)         NOT NULL DEFAULT 1 COMMENT 'Visível ao usuário'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grupo padrão de todo usuário novo (idempotente).
INSERT IGNORE INTO users_groups (id, name, max_files, max_size_mb, waiting_time_for_deletion, monthly_amount, annual_value, visible_to_the_user)
VALUES (1, 'Gratuito', 100, 5, 30, 0.00, 0.00, 1);

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  email         VARCHAR(254) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  -- Espaço usado na nuvem, em bytes: arquivos + área de trabalho (textos não salvos). Recalculado a cada gravação.
  storage_bytes BIGINT       NOT NULL DEFAULT 0,
  -- Último acesso (UTC): cadastro, login e qualquer requisição autenticada.
  last_access   DATETIME(3)  NULL,
  users_groups_id INT UNSIGNED NOT NULL DEFAULT 1,
  -- Número de arquivos do usuário na nuvem. Recalculado junto com storage_bytes.
  stored_files  INT UNSIGNED NOT NULL DEFAULT 0,
  -- Assinatura do plano pago (Stripe): período, estado, se está no período pago e as datas de pagamento (UTC).
  subscription_period    VARCHAR(10)  NULL COMMENT 'mensal, semestral ou anual',
  subscription_status    VARCHAR(20)  NULL COMMENT 'pending, active, canceled, payment_failed ou ended',
  subscription_active    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'No período pago',
  last_payment_at        DATETIME(3)  NULL COMMENT 'Data do último pagamento',
  next_payment_at        DATETIME(3)  NULL COMMENT 'Data do próximo pagamento (fim do período pago)',
  stripe_customer_id     VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  previous_users_groups_id INT UNSIGNED NULL COMMENT 'Plano antes de voltar ao Gratuito (prazo da limpeza)',
  cloud_purged_at        DATETIME(3)  NULL COMMENT 'Arquivos apagados por inatividade (aviso pendente no aplicativo)',
  cloud_purge_days       SMALLINT UNSIGNED NULL COMMENT 'Dias sem acesso que levaram à limpeza',
  locale                 VARCHAR(8)   NULL COMMENT 'Idioma do aplicativo (e-mails da API)',
  expiry_notice_for      DATETIME(3)  NULL COMMENT 'Fim do período cujo aviso de vencimento o aplicativo já mostrou',
  expiry_email_for       DATETIME(3)  NULL COMMENT 'Fim do período cujo e-mail de vencimento já foi enviado',
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_stripe_subscription (stripe_subscription_id),
  CONSTRAINT fk_users_group FOREIGN KEY (users_groups_id) REFERENCES users_groups (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64)    NOT NULL PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  KEY ix_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS manage_tokens (
  token_hash CHAR(64)    NOT NULL PRIMARY KEY COMMENT 'SHA-256 do token da página de gestão da assinatura',
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  KEY ix_manage_tokens_user (user_id),
  CONSTRAINT fk_manage_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64)    NOT NULL PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  KEY ix_resets_user (user_id),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS files (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  path       VARCHAR(512) NOT NULL,
  content    LONGTEXT     NOT NULL,
  encoding   VARCHAR(10)  NOT NULL,
  version    INT          NOT NULL,
  size       INT          NOT NULL,
  updated_at DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_files_user_path (user_id, path),
  CONSTRAINT fk_files_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pastas criadas pelo usuário (as pastas dos caminhos dos arquivos existem implicitamente).
CREATE TABLE IF NOT EXISTS folders (
  user_id CHAR(36)     NOT NULL,
  path    VARCHAR(512) NOT NULL,
  PRIMARY KEY (user_id, path),
  CONSTRAINT fk_folders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Área de trabalho sincronizada entre computadores: abas abertas e textos ainda não salvos (JSON).
CREATE TABLE IF NOT EXISTS workspaces (
  user_id    CHAR(36)    NOT NULL PRIMARY KEY,
  data       MEDIUMTEXT  NOT NULL,
  version    INT         NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_workspaces_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
