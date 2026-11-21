# Publicação na Microsoft Store

Material para publicar o Meu Editor de Arquivos na Microsoft Store, nos seis idiomas do aplicativo. O idioma principal é o **português do Brasil**.

| Pasta | Idioma na loja | Página do produto |
|---|---|---|
| `pt-BR/` | Português (Brasil), padrão | `listing.md` e `screenshots/` |
| `pt-PT/` | Português (Portugal) | `listing.md` e `screenshots/` |
| `en/` | Inglês (Estados Unidos) | `listing.md` e `screenshots/` |
| `es/` | Espanhol (Espanha) | `listing.md` e `screenshots/` |
| `fr/` | Francês (França) | `listing.md` e `screenshots/` |
| `de/` | Alemão (Alemanha) | `listing.md` e `screenshots/` |
| `images/` | Todos | Logotipos da página da loja (300x300 e 1080x1080) |

Cada `listing.md` traz os campos da página da loja: descrição, novidades, recursos, termos de pesquisa, legendas das telas e endereços (site, suporte e política de privacidade no mesmo idioma). As telas (1383x854 e 1920x1080, acima do mínimo de 1366x768) mostram o aplicativo no idioma da página.

## Passo a passo

1. **Reserve o nome** no [Partner Center](https://partner.microsoft.com/dashboard): Aplicativos e jogos → Novo produto → Aplicativo MSIX ou PWA → "Meu Editor de Arquivos".
2. **Copie a identidade do produto** (Gerenciamento do produto → Identidade do produto) para `electron-builder.yml`, seção `appx`:
   - `identityName` ← *Package/Identity/Name*
   - `publisher` ← *Package/Identity/Publisher* (começa com `CN=`)
   - `publisherDisplayName` ← *Package/Properties/PublisherDisplayName*
3. **Atualize as telas e os logotipos** (opcional, se a interface mudou):
   ```
   npm run manual
   npm run store:assets
   ```
   `store:assets` precisa do Python com Pillow (`pip install pillow`). Ele gera `build/appx/` (logotipos do pacote), `docs/store/images/` e `docs/store/<idioma>/screenshots/`.
4. **Gere o pacote** no Windows (precisa do Windows SDK, que traz o `makeappx`):
   ```
   npm run dist:store
   ```
   Saem em `dist/` os arquivos `.appx` para x64 e ARM64. A loja assina o pacote; não é preciso certificado próprio.
5. **Crie o envio** no Partner Center:
   - Preços e disponibilidade: gratuito, todos os mercados.
   - Propriedades: categoria Ferramentas de desenvolvimento; marque que o aplicativo acessa a internet (conta e nuvem) e informe a política de privacidade.
   - Classificação etária: responda ao questionário (sem conteúdo sensível).
   - Pacotes: envie os `.appx` de `dist/`.
   - Listagens da Store: adicione os seis idiomas e preencha cada um com o `listing.md` e as telas da pasta do idioma. Comece pelo Português (Brasil).
6. **Envie para certificação.** O endereço da loja (`https://apps.microsoft.com/detail/9P9LZ413B1XL`, ID da Store 9P9LZ413B1XL) já está em `website/includes/bootstrap.php` (`STORE_URL`); o botão "Microsoft Store" do site só abre a página depois que o aplicativo for publicado.

## Antes de enviar

- A política de privacidade precisa estar no ar: `https://meueditordearquivos.aplicativoia.online/privacidade.php` (já existe no site, nos seis idiomas). Revise o texto com quem cuida da LGPD.
- O pacote da loja não usa o instalador NSIS nem a versão portátil: esses continuam em `npm run dist:win` para quem baixa fora da loja.
- A versão do pacote vem de `package.json` (`1.0.0` → `1.0.0.0`). Cada novo envio precisa de uma versão maior.
