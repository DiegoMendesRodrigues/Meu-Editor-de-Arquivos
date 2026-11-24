// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { IpcChannels } from '@shared/ipc'
import { handle } from '../ipc/secure'
import { cancelGrpc, endGrpc, loadGrpc, sendGrpc, startGrpc } from './grpc'

/** Canais do gRPC (fase 5): carregar serviços, abrir, enviar, fechar e cancelar chamadas. Os eventos saem por api:grpc-event. */
export function registerGrpcHandlers(): void {
  handle(IpcChannels.apiGrpcLoad, (e, raw: unknown) => loadGrpc(e.sender, raw))
  handle(IpcChannels.apiGrpcStart, (e, raw: unknown) => startGrpc(e.sender, raw))
  handle(IpcChannels.apiGrpcSend, (e, id: unknown, message: unknown) => sendGrpc(e.sender, id, message))
  handle(IpcChannels.apiGrpcEnd, (e, id: unknown): void => endGrpc(e.sender, id))
  handle(IpcChannels.apiGrpcCancel, (e, id: unknown): void => cancelGrpc(e.sender, id))
}
