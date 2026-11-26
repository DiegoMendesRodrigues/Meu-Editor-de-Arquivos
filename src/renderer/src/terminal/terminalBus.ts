// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Liga os shells do Main às telas de terminal. A saída que chega antes de a tela existir
 * (o shell começa a escrever logo ao abrir) fica guardada e é entregue quando ela se conecta.
 */
import { useTerminals } from '@/store/terminals'

type Writer = (data: string) => void

const writers = new Map<number, Writer>()
const pending = new Map<number, string[]>()
let started = false

function start(): void {
  if (started) return
  started = true
  window.api.onTerminalData((id, data) => {
    const write = writers.get(id)
    if (write) write(data)
    else pending.set(id, [...(pending.get(id) ?? []), data])
  })
  // O shell terminou (exit): a aba fecha, como nos editores de código.
  window.api.onTerminalExit((id) => {
    writers.delete(id)
    pending.delete(id)
    useTerminals.getState().remove(id)
  })
}

/** Abre um shell novo no Main e a aba correspondente. */
export async function createTerminal(): Promise<void> {
  start()
  const id = await window.api.terminalCreate({ cols: 80, rows: 24 })
  useTerminals.getState().add(id)
}

/** A tela do terminal passa a receber a saída; devolve a função que a desliga. */
export function connect(id: number, write: Writer): () => void {
  writers.set(id, write)
  for (const data of pending.get(id) ?? []) write(data)
  pending.delete(id)
  return () => {
    if (writers.get(id) === write) writers.delete(id)
  }
}

/** Fecha a aba e encerra o shell. */
export function closeTerminal(id: number): void {
  writers.delete(id)
  pending.delete(id)
  useTerminals.getState().remove(id)
  void window.api.terminalKill(id).catch(() => {})
}
