import { app, ipcMain } from 'electron'
import { IpcChannels, type AppInfo } from '@shared/ipc'

export function registerAppHandlers(): void {
  ipcMain.handle(IpcChannels.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform
  }))
}
