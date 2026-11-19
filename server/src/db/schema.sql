-- Esquema para MySQL 8+ / MariaDB 10.6+. Aplique com: npm run migrate

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  email         VARCHAR(254) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64)    NOT NULL PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  KEY ix_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
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
