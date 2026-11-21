#!/usr/bin/env bash
# Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
# Remove o serviço e os arquivos da API. A configuração (/etc/meu-editor-api) e o banco são mantidos.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Execute como root." >&2; exit 1; }
systemctl disable --now meu-editor-api 2>/dev/null || true
rm -f /etc/systemd/system/meu-editor-api.service
systemctl daemon-reload
rm -rf /opt/meu-editor-api
echo "API removida. Configuração mantida em /etc/meu-editor-api (apague manualmente se quiser)."
