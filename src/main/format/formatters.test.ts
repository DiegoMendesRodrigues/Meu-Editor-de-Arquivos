// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatSource } from './formatters'

const ok = async (language: string, text: string, extension = ''): Promise<string> => {
  const result = await formatSource(language, extension, text)
  if (result.status !== 'ok') throw new Error(`${language}: ${result.status}`)
  return result.text
}

describe('auto formatação', () => {
  it('formata cada linguagem no seu padrão', async () => {
    expect(await ok('javascript', 'const a={b:1,c:[1,2]}')).toBe('const a = { b: 1, c: [1, 2] };\n')
    expect(await ok('typescript', 'const x=<div a="1">oi</div>', 'tsx')).toBe('const x = <div a="1">oi</div>;\n')
    expect(await ok('json', '{"a":1,"b":[true,null]}')).toBe('{ "a": 1, "b": [true, null] }\n')
    expect(await ok('css', 'a{color:red;margin:0}')).toBe('a {\n  color: red;\n  margin: 0;\n}\n')
    expect(await ok('markdown', '# Título\n* um\n* dois')).toBe('# Título\n\n- um\n- dois\n')
    expect(await ok('yaml', 'a:   1\nb:\n    - x')).toBe('a: 1\nb:\n  - x\n')
    expect(await ok('php', '<?php echo   1+2;')).toBe('<?php echo 1 + 2;\n')
    expect(await ok('xml', '<a><b>1</b></a>')).toBe('<a>\n  <b>1</b>\n</a>\n')
    expect(await ok('c', 'int main(){return 0;}')).toBe('int main() { return 0; }')
    expect(await ok('java', 'class A{void f(){int x=1;}}')).toContain('void f() {\n    int x = 1;')
    expect(await ok('csharp', 'class A{void F(){}}')).toContain('class A\n{')
    expect(await ok('python', 'def f( a,b ):\n  return a+b')).toBe('def f(a, b):\n    return a + b\n')
    expect(await ok('go', 'package main\nfunc main(){\nx:=1\n_=x}')).toBe('package main\n\nfunc main() {\n\tx := 1\n\t_ = x\n}\n')
    expect(await ok('lua', 'local a={1,2}\nif a then print(a) end')).toContain('local a = { 1, 2 }')
    expect(await ok('shell', 'if [ 1 ];then\necho oi\nfi')).toBe('if [ 1 ]; then\n\techo oi\nfi\n')
    expect(await ok('sql', 'select a,b from t where a=1')).toBe('SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  a = 1')
  }, 60_000)

  it('não formata linguagens sem formatador nem código inválido', async () => {
    expect(await formatSource('rust', 'rs', 'fn main(){}')).toEqual({ status: 'unsupported' })
    expect(await formatSource('plaintext', 'txt', 'oi')).toEqual({ status: 'unsupported' })
    expect(await formatSource('python', 'py', 'def (:')).toMatchObject({ status: 'invalid' })
    expect(await formatSource('json', 'json', '{a:')).toMatchObject({ status: 'invalid' })
  })
})
