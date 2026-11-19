# Ícone – Meu Editor de Arquivos

Pacote de ícones da aplicação: círculo com três faixas de azul inclinadas a 30° (a faixa superior é a mais clara) e símbolo de documento de código em branco.

## Conteúdo

| Arquivo | Uso |
|---|---|
| `meu-editor-de-arquivos.svg` | Master vetorial. Use em tela sempre que possível. |
| `favicon.ico` | Favicon multi-resolução (16 a 256 px). |
| `png/icone-16.png` … `png/icone-1024.png` | Tamanhos rasterizados. |
| `png/apple-touch-icon.png` | 180×180 px para iOS. |
| `site.webmanifest` | Manifesto PWA com os ícones 192 e 512. |

## Paleta

| Faixa | Cor |
|---|---|
| Superior (clara) | `#42A5F5` |
| Meio | `#1E7BE0` |
| Inferior (escura) | `#1452B0` |
| Símbolo | `#FFFFFF` |

## Integração no front-end

Copie os arquivos para a pasta de estáticos do projeto (ex.: `static/icones/` no Flask) e inclua no `<head>`:

```html
<link rel="icon" href="/static/icones/favicon.ico" sizes="any">
<link rel="icon" href="/static/icones/meu-editor-de-arquivos.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/static/icones/png/apple-touch-icon.png">
<link rel="manifest" href="/static/icones/site.webmanifest">
<meta name="theme-color" content="#1E7BE0">
```

O ícone tem fundo próprio (círculo azul), então funciona igual nos modos claro e escuro.
