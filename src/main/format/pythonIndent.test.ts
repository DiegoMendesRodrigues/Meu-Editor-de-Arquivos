// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { guessPythonIndentation } from './pythonIndent'
import { errorLine, formatSource } from './formatters'

const lines = (...l: string[]): string => l.join('\n')

describe('indentação deduzida do Python', () => {
  it('def fica aberto até a linha em branco; if fica com a linha seguinte', () => {
    expect(
      guessPythonIndentation(lines('def exibir(nome):', "if nome == 'ana':", "print('Ops')", 'print(nome)', '', "    exibir('Diego')", ''))
    ).toBe(lines('def exibir(nome):', "    if nome == 'ana':", "        print('Ops')", '    print(nome)', '', "exibir('Diego')", ''))
  })

  it('else, elif, except e finally voltam ao bloco a que pertencem', () => {
    expect(guessPythonIndentation(lines('for i in l:', 'if i:', 'print(i)', 'elif i < 0:', 'print(-i)', 'else:', 'print(0)', 'fim()'))).toBe(
      lines('for i in l:', '    if i:', '        print(i)', '    elif i < 0:', '        print(-i)', '    else:', '        print(0)', 'fim()')
    )
    expect(guessPythonIndentation(lines('try:', 'x()', 'except E:', 'y()', 'finally:', 'z()'))).toBe(
      lines('try:', '    x()', 'except E:', '    y()', 'finally:', '    z()')
    )
  })

  it('class fica aberta entre métodos; return fecha o def', () => {
    expect(guessPythonIndentation(lines('class A:', 'def f(self):', 'return 1', 'def g(self):', 'pass', '', '', 'A()'))).toBe(
      lines('class A:', '    def f(self):', '        return 1', '    def g(self):', '        pass', '', '', 'A()')
    )
  })

  it('mantém continuações entre parênteses e o texto das strings de três aspas', () => {
    expect(guessPythonIndentation(lines('def f():', 'x = [1,', '2]', 's = """a', '  b"""', 'return x # fim:'))).toBe(
      lines('def f():', '    x = [1,', '        2]', '    s = """a', '  b"""', '    return x # fim:')
    )
  })
})

describe('auto formatação do Python', () => {
  it('formata o código sem indentação com a indentação deduzida', async () => {
    const result = await formatSource('python', 'py', lines('def exibir(nome):', "if nome == 'ana':", "print('Ops')", 'print(nome)', '', "    exibir('Diego')", ''))
    expect(result).toEqual({
      status: 'ok',
      guessedIndent: true,
      text: lines('def exibir(nome):', "    if nome == 'ana':", "        print('Ops')", '    print(nome)', '', '', "exibir('Diego')", '')
    })
  })

  it('código válido não passa pela dedução', async () => {
    expect(await formatSource('python', 'py', 'x  =  1\n')).toEqual({ status: 'ok', text: 'x = 1\n' })
  })

  it('informa a linha do erro quando nem a dedução resolve', async () => {
    expect(await formatSource('python', 'py', 'x = 1\ny = (\n')).toEqual({ status: 'invalid', line: 3 })
    expect(await formatSource('json', 'json', '{\n"a": 1,,\n}')).toEqual({ status: 'invalid', line: 2 })
    expect(errorLine(new Error('Expected x at byte range 4..5'), 'ção\nb')).toBe(1)
  })
})
