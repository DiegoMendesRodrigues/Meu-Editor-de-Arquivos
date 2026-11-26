-- Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
-- Valor semestral dos planos (users_groups.semestral), para um banco JÁ EXISTENTE.
-- Cole no phpMyAdmin (aba SQL) ou rode no cliente mysql. "npm run migrate" faz o mesmo (idempotente).
-- Use só UM dos comandos abaixo:

-- Banco sem a coluna:
ALTER TABLE users_groups
  ADD COLUMN semestral DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Valor semestral' AFTER monthly_amount;

-- Banco que já tinha a coluna com o nome antigo (semiannual_amount):
-- ALTER TABLE users_groups
--   CHANGE COLUMN semiannual_amount semestral DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Valor semestral';
