-- Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
-- Avisos de plano perto de expirar (caixa no aplicativo a 7 dias e e-mail a 2 dias), para um banco JÁ EXISTENTE.
-- Cole no phpMyAdmin (aba SQL) ou rode no cliente mysql. "npm run migrate" faz o mesmo (idempotente).
-- Roda uma vez só: se uma coluna já existir, o servidor avisa (erro 1060) e basta pular o comando.

ALTER TABLE users
  ADD COLUMN locale            VARCHAR(8)  NULL COMMENT 'Idioma do aplicativo (e-mails da API)',
  ADD COLUMN expiry_notice_for DATETIME(3) NULL COMMENT 'Fim do período cujo aviso de vencimento o aplicativo já mostrou',
  ADD COLUMN expiry_email_for  DATETIME(3) NULL COMMENT 'Fim do período cujo e-mail de vencimento já foi enviado';
