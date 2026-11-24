// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/

/**
 * Limite de eventos por segundo do streaming gRPC: o que passa do limite espera numa fila curta; o que não cabe
 * na fila é descartado e contado (um evento resumo avisa quantos). Se o descarte persiste, o stream é pausado
 * até a próxima janela, para a memória e a CPU não crescerem com um servidor que despeja mensagens.
 */
export interface ThrottleOptions<T> {
  perSecond: number
  queueMax: number
  /** Descartes numa janela que fazem o stream pausar até a próxima. */
  pauseAfterDropped: number
  send: (item: T) => void
  summary: (dropped: number) => void
  pause: () => void
  resume: () => void
  now?: () => number
}

const WINDOW_MS = 1000

export class EventThrottle<T> {
  private windowStart: number
  private sent = 0
  private windowDropped = 0
  private dropped = 0
  private queue: T[] = []
  private paused = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private readonly now: () => number

  constructor(private readonly o: ThrottleOptions<T>) {
    this.now = o.now ?? Date.now
    this.windowStart = this.now()
  }

  push(item: T): void {
    if (this.closed) return
    if (this.now() - this.windowStart >= WINDOW_MS) this.advance()
    if (this.queue.length === 0 && this.sent < this.o.perSecond) {
      this.sent++
      this.o.send(item)
      return
    }
    if (this.queue.length < this.o.queueMax) this.queue.push(item)
    else {
      this.dropped++
      this.windowDropped++
      if (!this.paused && this.windowDropped >= this.o.pauseAfterDropped) {
        this.paused = true
        this.o.pause()
      }
    }
    this.schedule()
  }

  /** Nova janela: esvazia o que a fila tem dentro do limite, avisa dos descartes e retoma o stream. */
  private advance(): void {
    this.timer = null
    this.windowStart = this.now()
    this.sent = 0
    this.windowDropped = 0
    while (this.queue.length > 0 && this.sent < this.o.perSecond) {
      this.sent++
      this.o.send(this.queue.shift() as T)
    }
    this.reportDropped()
    if (this.paused) {
      this.paused = false
      this.o.resume()
    }
    if (this.queue.length > 0) this.schedule()
  }

  private reportDropped(): void {
    if (this.dropped === 0) return
    const n = this.dropped
    this.dropped = 0
    this.o.summary(n)
  }

  private schedule(): void {
    if (this.timer || this.closed) return
    this.timer = setTimeout(() => this.advance(), Math.max(0, this.windowStart + WINDOW_MS - this.now()))
    this.timer.unref?.()
  }

  /** Fim do stream: entrega o que ficou na fila (é curta), avisa dos descartes e para. */
  flush(): void {
    if (this.closed) return
    this.dispose()
    for (const item of this.queue.splice(0)) this.o.send(item)
    this.reportDropped()
  }

  dispose(): void {
    this.closed = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
