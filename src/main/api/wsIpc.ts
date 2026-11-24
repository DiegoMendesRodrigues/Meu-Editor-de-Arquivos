// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { IpcChannels } from '@shared/ipc'
import { handle } from '../ipc/secure'
import { closeWs, connectWs, sendWs } from './ws'

/** Canais do WebSocket (fase 4): abrir, enviar e fechar. Os eventos saem por api:ws-event. */
export function registerWsHandlers(): void {
  handle(IpcChannels.apiWsConnect, (e, raw: unknown) => connectWs(e.sender, raw))
  handle(IpcChannels.apiWsSend, (e, id: unknown, message: unknown) => sendWs(e.sender, id, message))
  handle(IpcChannels.apiWsClose, (e, id: unknown, code?: unknown): void => closeWs(e.sender, id, code))
}
