-- Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
-- Planos (grupos de usuários), administradores e novos campos de users, para um banco JÁ EXISTENTE.
-- Cole no phpMyAdmin (aba SQL) ou rode no cliente mysql. MySQL 8+ / MariaDB 10.6+.
-- Equivale ao que "npm run migrate" faz (que é idempotente). Os ALTER TABLE rodam uma vez só: se uma coluna
-- ou a chave já existir, o servidor avisa (erro 1060 / 1061 / 1826) e basta pular aquele comando.

CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL COMMENT 'Nome do Administrador',
  email         VARCHAR(200) NOT NULL COMMENT 'E-mail (login do administrador)',
  password_hash VARCHAR(64)  NOT NULL COMMENT 'SHA-256 em hexadecimal (fraco: prefira scrypt)',
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

INSERT IGNORE INTO users_groups (id, name, max_files, max_size_mb, waiting_time_for_deletion, monthly_amount, annual_value, visible_to_the_user)
VALUES (1, 'Gratuito', 100, 5, 30, 0.00, 0.00, 1);

-- Novos campos de users (o DEFAULT 1 já coloca os usuários existentes no grupo Gratuito).
ALTER TABLE users ADD COLUMN last_access DATETIME(3) NULL;
ALTER TABLE users ADD COLUMN users_groups_id INT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN stored_files INT UNSIGNED NOT NULL DEFAULT 0;

UPDATE users SET last_access = UTC_TIMESTAMP(3) WHERE last_access IS NULL;
UPDATE users SET users_groups_id = 1 WHERE users_groups_id = 0;
UPDATE users u SET u.stored_files = (SELECT COUNT(*) FROM files f WHERE f.user_id = u.id);

ALTER TABLE users ADD CONSTRAINT fk_users_group FOREIGN KEY (users_groups_id) REFERENCES users_groups (id);

-- Administrador (opcional). SHA-256 simples e sem sal é fraco; o scrypt é o recomendado. Troque os valores de exemplo:
-- INSERT INTO admins (name, email, password_hash) VALUES ('Nome', 'email@exemplo.com', SHA2('TROQUE_PELA_SENHA', 256));
