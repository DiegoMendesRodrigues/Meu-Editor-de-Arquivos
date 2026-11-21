#!/usr/bin/env bash
# Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
# Instalador da API do Meu Editor de Arquivos para Debian 12/13, Ubuntu 22.04+ e derivados (systemd).
# Uso: sudo ./install.sh            (instala ou atualiza)
#      sudo ./install.sh --migrate  (também aplica o esquema do banco)
set -euo pipefail

APP_DIR=/opt/meu-editor-api
CONF_DIR=/etc/meu-editor-api
ENV_FILE=$CONF_DIR/api.env
SERVICE=meu-editor-api
SVC_USER=meu-editor-api
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATE=false
[[ "${1:-}" == "--migrate" ]] && MIGRATE=true

[[ $EUID -eq 0 ]] || { echo "Execute como root (sudo ./install.sh)." >&2; exit 1; }
command -v systemctl >/dev/null || { echo "systemd não encontrado." >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js não encontrado. Instale o Node.js 22 LTS ou mais novo (veja INSTALL)." >&2; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
(( NODE_MAJOR >= 22 )) || { echo "Node.js $NODE_MAJOR encontrado; é preciso o 22 ou mais novo." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm não encontrado." >&2; exit 1; }

echo "==> Usuário de serviço"
id -u "$SVC_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$SVC_USER"

echo "==> Copiando arquivos para $APP_DIR"
systemctl stop "$SERVICE" 2>/dev/null || true
mkdir -p "$APP_DIR"
rm -rf "$APP_DIR/dist"
cp -r "$SRC_DIR/dist" "$APP_DIR/"
cp "$SRC_DIR/server.js" "$SRC_DIR/package.json" "$SRC_DIR/package-lock.json" "$APP_DIR/"

echo "==> Instalando dependências de produção"
(cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund)
chown -R root:root "$APP_DIR"
chmod -R go-w "$APP_DIR"

echo "==> Configuração"
mkdir -p "$CONF_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$SRC_DIR/api.env.example" "$ENV_FILE"
  NEW_ENV=true
else
  NEW_ENV=false
fi
chown root:"$SVC_USER" "$CONF_DIR" "$ENV_FILE"
chmod 750 "$CONF_DIR"
chmod 640 "$ENV_FILE"

echo "==> Serviço systemd"
cp "$SRC_DIR/meu-editor-api.service" /etc/systemd/system/$SERVICE.service
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null

if $NEW_ENV; then
  echo
  echo "Configuração criada em $ENV_FILE."
  echo "Edite DATABASE_URL e depois rode:  sudo $0 --migrate"
  exit 0
fi

if $MIGRATE; then
  echo "==> Aplicando o esquema do banco"
  (cd "$APP_DIR" && set -a && . "$ENV_FILE" && set +a && runuser -u "$SVC_USER" -- env DATABASE_URL="$DATABASE_URL" node dist/migrate.js)
fi

systemctl restart "$SERVICE"
sleep 2
if systemctl is-active --quiet "$SERVICE"; then
  echo
  echo "API em execução. Logs: journalctl -u $SERVICE -f"
else
  echo "A API não iniciou. Veja: journalctl -u $SERVICE -n 50" >&2
  exit 1
fi
