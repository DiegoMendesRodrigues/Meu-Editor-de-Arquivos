-- Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
-- Limpeza da nuvem por inatividade e página de gestão da assinatura, para um banco JÁ EXISTENTE.
-- Cole no phpMyAdmin (aba SQL) ou rode no cliente mysql. "npm run migrate" faz o mesmo (idempotente).
-- Roda uma vez só: se uma coluna ou a tabela já existir, o servidor avisa (erro 1060 / 1050) e basta pular o comando.

ALTER TABLE users
  ADD COLUMN previous_users_groups_id INT UNSIGNED NULL COMMENT 'Plano antes de voltar ao Gratuito (prazo da limpeza)',
  ADD COLUMN cloud_purged_at          DATETIME(3)  NULL COMMENT 'Arquivos apagados por inatividade (aviso pendente no aplicativo)',
  ADD COLUMN cloud_purge_days         SMALLINT UNSIGNED NULL COMMENT 'Dias sem acesso que levaram à limpeza';

CREATE TABLE manage_tokens (
  token_hash CHAR(64)    NOT NULL PRIMARY KEY COMMENT 'SHA-256 do token da página de gestão da assinatura',
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  KEY ix_manage_tokens_user (user_id),
  CONSTRAINT fk_manage_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
