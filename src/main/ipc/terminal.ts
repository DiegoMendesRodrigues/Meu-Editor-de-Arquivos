// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Terminal integrado (Ferramentas → Abrir o terminal). O Main abre o shell do usuário num
 * pseudoterminal (node-pty), sempre na pasta pessoal; o Renderer só envia o que é digitado e o
 * tamanho da janela, e recebe a saída. O Renderer não escolhe o programa, os argumentos nem a pasta.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { WebContents } from 'electron'
import log from 'electron-log/main'
import * as pty from 'node-pty'
import { z } from 'zod'
import { IpcChannels } from '@shared/ipc'
import { handle } from './secure'

/** No máximo estes terminais abertos ao mesmo tempo. */
const MAX_TERMINALS = 10

interface Session {
  pty: pty.IPty
  owner: WebContents
}

const sessions = new Map<number, Session>()
let nextId = 1

/** Shell do usuário: PowerShell no Windows; no Linux, o do $SHELL (ou bash, ou sh). */
function userShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    const root = process.env['SystemRoot'] ?? 'C:\\Windows'
    const powershell = join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    return { file: existsSync(powershell) ? powershell : (process.env['ComSpec'] ?? 'cmd.exe'), args: existsSync(powershell) ? ['-NoLogo'] : [] }
  }
  const shell = process.env['SHELL']
  if (shell && existsSync(shell)) return { file: shell, args: [] }
  return { file: existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh', args: [] }
}

const idSchema = z.number().int().positive()
const sizeSchema = z.object({ cols: z.number().int().min(2).max(1000), rows: z.number().int().min(1).max(500) })

/** Só quem abriu o terminal pode usá-lo. */
function own(e: { sender: WebContents }, raw: unknown): Session {
  const session = sessions.get(idSchema.parse(raw))
  if (!session || session.owner !== e.sender) throw new Error('Terminal inexistente.')
  return session
}

function kill(id: number): void {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  try {
    session.pty.kill()
  } catch {
    // o processo já terminou
  }
}

const watched = new WeakSet<WebContents>()

/** A janela fechou ou recarregou: os shells dela são encerrados. */
function watchOwner(owner: WebContents): void {
  if (watched.has(owner)) return
  watched.add(owner)
  const killOwned = (): void => {
    for (const [id, s] of sessions) if (s.owner === owner) kill(id)
  }
  owner.once('destroyed', killOwned)
  owner.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) killOwned()
  })
}

/** Ambiente do shell sem as variáveis que mudam o comportamento do Electron/Node (ELECTRON_*, NODE_OPTIONS). */
export function shellEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue
    const up = k.toUpperCase()
    if (up.startsWith('ELECTRON_') || up === 'NODE_OPTIONS' || up === 'NODE_PATH') continue
    out[k] = v
  }
  return out
}

export function killAllTerminals(): void {
  for (const id of [...sessions.keys()]) kill(id)
}

export function registerTerminalHandlers(): void {
  handle(IpcChannels.terminalCreate, (e, rawSize: unknown): number => {
    if (sessions.size >= MAX_TERMINALS) throw new Error(`Limite de ${MAX_TERMINALS} terminais abertos.`)
    const { cols, rows } = sizeSchema.parse(rawSize)
    const { file, args } = userShell()
    const id = nextId++
    const owner = e.sender
    const proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: homedir(),
      env: { ...shellEnv(), TERM: 'xterm-256color', COLORTERM: 'truecolor' }
    })
    sessions.set(id, { pty: proc, owner })
    proc.onData((data) => {
      if (!owner.isDestroyed()) owner.send(IpcChannels.terminalData, id, data)
    })
    proc.onExit(({ exitCode }) => {
      sessions.delete(id)
      if (!owner.isDestroyed()) owner.send(IpcChannels.terminalExit, id, exitCode)
    })
    watchOwner(owner)
    log.info(`Terminal ${id} aberto (${file})`)
    return id
  })

  handle(IpcChannels.terminalWrite, (e, rawId: unknown, rawData: unknown) => {
    own(e, rawId).pty.write(z.string().max(1024 * 1024).parse(rawData))
  })

  handle(IpcChannels.terminalResize, (e, rawId: unknown, rawSize: unknown) => {
    const { cols, rows } = sizeSchema.parse(rawSize)
    own(e, rawId).pty.resize(cols, rows)
  })

  handle(IpcChannels.terminalKill, (e, rawId: unknown) => {
    own(e, rawId)
    kill(idSchema.parse(rawId))
  })
}
