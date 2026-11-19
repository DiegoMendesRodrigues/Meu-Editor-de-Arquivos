// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { join } from 'node:path'
import { app, nativeImage } from 'electron'

/** Ícone das janelas e da barra de tarefas (ico no Windows, png no Linux); vazio se o arquivo não existir. */
export function windowIcon(): Electron.NativeImage | undefined {
  const file = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const image = nativeImage.createFromPath(join(app.getAppPath(), 'build', file))
  return image.isEmpty() ? undefined : image
}
