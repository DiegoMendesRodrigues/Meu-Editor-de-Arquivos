// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Servidor que imita o Ollama sem modelos; o /api/pull manda progresso em NDJSON e, no fim, o modelo passa a
 * aparecer em /api/tags. Nenhum instalador de verdade é executado aqui.
 */
let ollama: Server
let ollamaUrl = ''
let installed: string[] = []
const pulled: string[] = []

test.beforeAll(async () => {
  ollama = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      if (req.url === '/api/version') return void res.end(JSON.stringify({ version: '0.5.1' }))
      if (req.url === '/api/tags') return void res.end(JSON.stringify({ models: installed.map((name) => ({ name })) }))
      if (req.url === '/api/pull') {
        const model = (JSON.parse(raw) as { model: string }).model
        pulled.push(model)
        const line = (o: unknown): boolean => res.write(JSON.stringify(o) + '\n')
        line({ status: 'pulling manifest' })
        if (model === 'modelo-lento') {
          // Nunca termina: serve para o teste de cancelamento.
          const t = setInterval(() => line({ status: 'pulling abc123', total: 1000, completed: 100 }), 50)
          res.on('close', () => clearInterval(t))
          return
        }
        let completed = 0
        const t = setInterval(() => {
          completed += 250
          line({ status: 'pulling abc123', digest: 'sha256:abc', total: 1000, completed })
          if (completed >= 1000) {
            clearInterval(t)
            installed.push(`${model}`)
            line({ status: 'success' })
            res.end()
          }
        }, 120)
        res.on('close', () => clearInterval(t))
        return
      }
      if (req.url === '/api/delete' && req.method === 'DELETE') {
        const model = (JSON.parse(raw) as { model: string }).model
        installed = installed.filter((m) => m !== model)
        return void res.end()
      }
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise<void>((ok) => ollama.listen(0, '127.0.0.1', ok))
  ollamaUrl = `http://127.0.0.1:${(ollama.address() as AddressInfo).port}`
})

test.afterAll(() => {
  ollama.closeAllConnections()
  ollama.close()
})

test.beforeEach(() => {
  installed = []
  pulled.length = 0
})

async function configure(page: Page, host: string): Promise<void> {
  await page.evaluate((h) => window.api.aiSetSettings({ host: h, model: '', temperature: 0.5, allowRemote: false }), host)
}

async function openAssistant(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ferramentas' }).click()
  await page.getByRole('menuitem', { name: /Assistente de IA/ }).click()
  await expect(page.getByTestId('ai-panel')).toBeVisible()
}

test.describe('Instalação do Ollama e modelos', () => {
  test('sem modelos: baixa um modelo com progresso e ele aparece selecionado', async ({ page }) => {
    await configure(page, ollamaUrl)
    await openAssistant(page)
    await expect(page.getByTestId('ai-no-model')).toBeVisible()

    await page.getByTestId('ai-pull-llama3.2:3b').click()
    const progress = page.getByTestId('ai-progress')
    await expect(progress).toBeVisible()
    await expect(progress).toContainText('llama3.2:3b')
    await expect(page.getByRole('progressbar')).toBeVisible()
    await expect(page.getByTestId('ai-progress-text')).toContainText('%')

    await expect(page.getByTestId('ai-no-model')).toBeHidden({ timeout: 15_000 })
    await expect(page.getByRole('combobox', { name: 'Modelo' })).toHaveValue('llama3.2:3b')
    expect(pulled).toEqual(['llama3.2:3b'])
  })

  test('cancela o download no meio e nenhum modelo é instalado', async ({ page }) => {
    await configure(page, ollamaUrl)
    await openAssistant(page)
    await page.getByLabel('Nome de outro modelo').fill('modelo-lento')
    await page.getByTestId('ai-pull-custom').click()
    await expect(page.getByTestId('ai-progress')).toBeVisible()
    await page.getByTestId('ai-progress-cancel').click()
    await expect(page.getByTestId('ai-progress')).toBeHidden()
    await expect(page.getByTestId('ai-no-model')).toBeVisible()
    await expect(page.getByTestId('ai-op-error')).toHaveCount(0)
  })

  test('recusa nome de modelo inválido no campo livre', async ({ page }) => {
    await configure(page, ollamaUrl)
    await openAssistant(page)
    await page.getByLabel('Nome de outro modelo').fill('Nome Ruim; rm -rf')
    await expect(page.getByTestId('ai-pull-custom')).toBeDisabled()
    await expect(page.getByText(/Nome de modelo inválido/)).toBeVisible()
    expect(pulled).toEqual([])
  })

  test('exclui um modelo instalado depois de confirmar', async ({ page }) => {
    installed = ['llama3.2:3b', 'phi4-mini:latest']
    await configure(page, ollamaUrl)
    await openAssistant(page)
    await expect(page.getByRole('combobox', { name: 'Modelo' })).toBeVisible()
    await page.getByRole('button', { name: 'Configurações' }).click()
    await page.getByRole('button', { name: 'Excluir modelo: phi4-mini:latest' }).click()
    await page.getByTestId('ai-delete-confirm').click()
    await expect(page.getByRole('button', { name: 'Excluir modelo: phi4-mini:latest' })).toHaveCount(0)
    expect(installed).toEqual(['llama3.2:3b'])
  })

  test('com o Ollama parado, o assistente de passos aparece e a instalação pede confirmação', async ({ page }) => {
    await configure(page, 'http://127.0.0.1:1')
    await openAssistant(page)
    await expect(page.getByTestId('ai-install-help')).toBeVisible()
    const info = await page.evaluate(() => window.api.aiInstallInfo())
    expect(info.running).toBe(false)
    if (info.installed) {
      await expect(page.getByTestId('ai-start-server')).toBeVisible()
    } else if (info.platform === 'win32') {
      await page.getByTestId('ai-install-button').click()
      await expect(page.getByRole('dialog')).toContainText('ollama.com')
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click() // não baixa nem executa nada
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByTestId('ai-progress')).toHaveCount(0)
    } else if (info.platform === 'linux') {
      await expect(page.getByTestId('ai-linux-command')).toHaveText('curl -fsSL https://ollama.com/install.sh | sh')
      await expect(page.getByTestId('ai-open-terminal')).toBeVisible()
    }
  })
})
