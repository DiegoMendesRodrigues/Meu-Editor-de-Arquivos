// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'
import { expect, stubOpenDialog, test } from './fixtures'

/** Servidor que imita o Ollama (NDJSON em streaming) e uma API para a resposta explicada. */
let ollama: Server
let api: Server
let ollamaUrl = ''
let apiUrl = ''
const chatBodies: { model: string; messages: { role: string; content: string }[] }[] = []

test.beforeAll(async () => {
  ollama = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      if (req.url === '/api/version') return void res.end(JSON.stringify({ version: '0.5.1' }))
      if (req.url === '/api/tags') return void res.end(JSON.stringify({ models: [{ name: 'llama3.2:3b' }, { name: 'qwen2.5-coder:7b' }] }))
      if (req.url === '/api/chat') {
        chatBodies.push(JSON.parse(raw))
        const line = (content: string, done = false): string => JSON.stringify({ message: { role: 'assistant', content }, done }) + '\n'
        res.write(line('Resposta '))
        setTimeout(() => res.write(line('em streaming.\n\n```text\nTEXTO_DA_IA\n```\n')), 150)
        setTimeout(() => res.end(line('', true)), 300)
        return
      }
      res.statusCode = 404
      res.end()
    })
  })
  api = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ id: 7, nome: 'Ana' }))
  })
  await Promise.all([new Promise<void>((ok) => ollama.listen(0, '127.0.0.1', ok)), new Promise<void>((ok) => api.listen(0, '127.0.0.1', ok))])
  ollamaUrl = `http://127.0.0.1:${(ollama.address() as AddressInfo).port}`
  apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`
})

test.afterAll(() => {
  ollama.close()
  api.close()
})

/** Aponta o assistente para o servidor de mentira (o mesmo que o usuário faria nas configurações). */
async function configure(page: Page, host = ollamaUrl): Promise<void> {
  await page.evaluate((h) => window.api.aiSetSettings({ host: h, model: '', temperature: 0.5, allowRemote: false }), host)
}

async function openAssistant(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ferramentas' }).click()
  await page.getByRole('menuitem', { name: /Assistente de IA/ }).click()
  await expect(page.getByTestId('ai-panel')).toBeVisible()
}

test.describe('Assistente de IA (Ollama)', () => {
  test('abre pelo menu, conversa em streaming, insere no cursor e roda ação rápida', async ({ app, page, workspace }) => {
    await configure(page)
    await stubOpenDialog(app, [workspace.file('notas.txt')])
    await page.keyboard.press('Control+O')
    await expect(page.locator('.view-lines')).toContainText('primeira laranja')
    await page.locator('.monaco-editor').click()
    await page.keyboard.press('Control+End')

    await openAssistant(page)
    await expect(page.getByTestId('ai-status')).toHaveAttribute('data-state', 'ok')
    await expect(page.getByTestId('ai-status')).toContainText('Ollama 0.5.1 conectado')
    await expect(page.getByRole('combobox', { name: 'Modelo' })).toHaveValue('llama3.2:3b')

    // Pergunta e resposta em streaming; o bloco de código aparece com os três botões.
    await page.getByLabel('Pergunta ao assistente').fill('Escreva uma linha')
    await page.getByTestId('ai-send').click()
    await expect(page.getByTestId('ai-assistant-message').last()).toContainText('Resposta')
    await expect(page.getByTestId('ai-stop')).toBeVisible()
    const block = page.getByTestId('ai-code-block')
    await expect(block).toContainText('TEXTO_DA_IA')
    await expect(page.getByTestId('ai-send')).toBeVisible() // terminou
    expect(chatBodies.at(-1)!.model).toBe('llama3.2:3b')
    expect(chatBodies.at(-1)!.messages.at(-1)).toEqual({ role: 'user', content: 'Escreva uma linha' })

    // Inserir no cursor (fim do documento).
    await block.getByRole('button', { name: 'Inserir no cursor' }).click()
    await expect(page.locator('.view-lines')).toContainText('TEXTO_DA_IA')

    // Ação rápida sobre o documento inteiro: o nome e a linguagem vão no contexto.
    await page.getByTestId('ai-quick-summarize').click()
    await expect(page.getByTestId('ai-user-message').last()).toContainText('notas.txt')
    await expect(page.getByTestId('ai-send')).toBeVisible()
    const prompt = chatBodies.at(-1)!.messages.at(-1)!.content
    expect(prompt).toContain('Summarize')
    expect(prompt).toContain('notas.txt')
    expect(prompt).toContain('segunda laranja')

    // Nova conversa limpa a lista.
    await page.getByRole('button', { name: 'Nova conversa' }).click()
    await expect(page.getByTestId('ai-user-message')).toHaveCount(0)
  })

  test('Ctrl+Shift+I abre e fecha; sem o Ollama mostra como instalar', async ({ page }) => {
    await configure(page, 'http://127.0.0.1:9')
    await page.keyboard.press('Control+Shift+I')
    await expect(page.getByTestId('ai-panel')).toBeVisible()
    await expect(page.getByTestId('ai-status')).toHaveAttribute('data-state', 'down')
    const help = page.getByTestId('ai-install-help')
    await expect(help).toContainText('ollama pull')
    await expect(help.getByRole('button', { name: 'Abrir ollama.com' })).toBeVisible()
    await page.getByRole('button', { name: 'Fechar o assistente' }).click()
    await expect(page.getByTestId('ai-panel')).toHaveCount(0)
  })

  test('endereço remoto só com a opção marcada, e com aviso', async ({ page }) => {
    await page.keyboard.press('Control+Shift+I')
    await page.getByRole('button', { name: 'Configurações do assistente' }).click()
    const form = page.getByTestId('ai-settings')
    await expect(form.getByTestId('ai-remote-warning')).toContainText('saem deste computador')
    await form.getByLabel('Endereço do Ollama').fill('http://192.0.2.10:11434')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByRole('alert')).toContainText('não é permitido')
    await form.getByLabel('Permitir servidor Ollama em outro computador').check()
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Configurações salvas.')).toBeVisible()
  })

  test('Explicar com IA e Sugerir testes na resposta de uma requisição', async ({ page }) => {
    await configure(page)
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('URL da requisição').fill(`${apiUrl}/itens`)
    await page.getByTestId('api-send').click()
    await expect(page.getByTestId('api-status')).toContainText('200')

    await page.getByTestId('api-ai-explain').click()
    await expect(page.getByTestId('ai-panel')).toBeVisible()
    await expect(page.getByTestId('ai-assistant-message').last()).toContainText('TEXTO_DA_IA')
    const explain = chatBodies.at(-1)!.messages.at(-1)!.content
    expect(explain).toContain('Explain this HTTP exchange')
    expect(explain).toContain(`GET ${apiUrl}/itens`)
    expect(explain).toContain('"nome": "Ana"'.replace(': ', ':')) // corpo da resposta (JSON compacto do servidor)

    await expect(page.getByTestId('ai-send')).toBeVisible()
    await page.getByTestId('api-ai-tests').click()
    await expect(page.getByTestId('ai-user-message').last()).toContainText('Sugerir testes')
    await expect.poll(() => chatBodies.at(-1)!.messages.at(-1)!.content).toContain('"target"')
  })
})
