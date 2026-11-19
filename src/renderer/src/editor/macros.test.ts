// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { beforeEach, describe, expect, it } from 'vitest'
import { useLibrary } from '@/store/library'
import { isRecording, play, recordCommand, startRecording, stopRecording } from './macros'

describe('macros', () => {
  beforeEach(() => useLibrary.setState({ recording: false, steps: [] }))

  it('só grava comandos durante a gravação', () => {
    recordCommand('editor.action.sortLinesAscending')
    expect(useLibrary.getState().steps).toEqual([])
    startRecording()
    expect(isRecording()).toBe(true)
    recordCommand('editor.action.sortLinesAscending')
    stopRecording()
    recordCommand('cursorLeft')
    expect(useLibrary.getState().steps).toEqual([{ type: 'command', id: 'editor.action.sortLinesAscending' }])
  })

  it('iniciar uma nova gravação descarta a anterior', () => {
    useLibrary.setState({ steps: [{ type: 'text', text: 'velho' }] })
    startRecording()
    expect(useLibrary.getState().steps).toEqual([])
  })

  it('reproduzir sem editor ativo não faz nada', () => {
    expect(play([{ type: 'text', text: 'x' }])).toBe(false)
  })
})
