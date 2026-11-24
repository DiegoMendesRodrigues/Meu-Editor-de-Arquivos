// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { extractOperations, fieldPlainText, getCompletions, parseIntrospection, parseIntrospectionResponse } from './graphql'

const named = (name: string) => ({ kind: 'OBJECT', name, ofType: null })
const scalar = (name: string) => ({ kind: 'SCALAR', name, ofType: null })
const nonNull = (t: unknown) => ({ kind: 'NON_NULL', name: null, ofType: t })
const list = (t: unknown) => ({ kind: 'LIST', name: null, ofType: t })

/** Schema fictício: Query { hero(episode), users, me }, Mutation { addUser(input) }, enum Episode, union SearchResult. */
const introspection = {
  data: {
    __schema: {
      queryType: { name: 'Query' },
      mutationType: { name: 'Mutation' },
      subscriptionType: null,
      types: [
        {
          kind: 'OBJECT',
          name: 'Query',
          description: 'Raiz das consultas',
          fields: [
            {
              name: 'hero',
              description: 'Um herói',
              args: [
                { name: 'episode', description: 'Episódio', type: { kind: 'ENUM', name: 'Episode', ofType: null }, defaultValue: null },
                { name: 'id', description: '', type: nonNull(scalar('ID')), defaultValue: null }
              ],
              type: named('Character'),
              isDeprecated: false
            },
            { name: 'users', description: '', args: [], type: nonNull(list(nonNull(named('User')))), isDeprecated: false },
            { name: 'search', description: '', args: [], type: list(named('SearchResult')), isDeprecated: true },
            { name: 'ping', description: '', args: [{ name: 'loud', description: '', type: scalar('Boolean'), defaultValue: null }], type: scalar('String'), isDeprecated: false }
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null
        },
        {
          kind: 'OBJECT',
          name: 'Mutation',
          description: '',
          fields: [
            {
              name: 'addUser',
              description: '',
              args: [{ name: 'input', description: '', type: nonNull({ kind: 'INPUT_OBJECT', name: 'NewUser', ofType: null }), defaultValue: null }],
              type: named('User'),
              isDeprecated: false
            }
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null
        },
        {
          kind: 'INTERFACE',
          name: 'Character',
          description: '',
          fields: [
            { name: 'name', description: 'Nome', args: [], type: nonNull(scalar('String')), isDeprecated: false },
            { name: 'friends', description: '', args: [], type: list(named('Character')), isDeprecated: false }
          ],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: [named('User'), named('Droid')]
        },
        {
          kind: 'OBJECT',
          name: 'User',
          description: '',
          fields: [
            { name: 'name', description: '', args: [], type: nonNull(scalar('String')), isDeprecated: false },
            { name: 'email', description: '', args: [], type: scalar('String'), isDeprecated: false },
            { name: 'friends', description: '', args: [], type: list(named('Character')), isDeprecated: false }
          ],
          inputFields: null,
          interfaces: [named('Character')],
          enumValues: null,
          possibleTypes: null
        },
        {
          kind: 'OBJECT',
          name: 'Droid',
          description: '',
          fields: [{ name: 'primaryFunction', description: '', args: [], type: scalar('String'), isDeprecated: false }],
          inputFields: null,
          interfaces: [named('Character')],
          enumValues: null,
          possibleTypes: null
        },
        { kind: 'UNION', name: 'SearchResult', description: '', fields: null, inputFields: null, interfaces: null, enumValues: null, possibleTypes: [named('User'), named('Droid')] },
        {
          kind: 'ENUM',
          name: 'Episode',
          description: '',
          fields: null,
          inputFields: null,
          interfaces: null,
          enumValues: [
            { name: 'NEWHOPE', description: 'Episódio IV', isDeprecated: false },
            { name: 'EMPIRE', description: '', isDeprecated: false }
          ],
          possibleTypes: null
        },
        {
          kind: 'INPUT_OBJECT',
          name: 'NewUser',
          description: '',
          fields: null,
          inputFields: [{ name: 'name', description: '', type: nonNull(scalar('String')), defaultValue: null }],
          interfaces: null,
          enumValues: null,
          possibleTypes: null
        },
        { kind: 'SCALAR', name: 'String', description: '', fields: null, inputFields: null, interfaces: null, enumValues: null, possibleTypes: null }
      ]
    }
  }
}

const model = parseIntrospection(introspection)!

/** Sugestões na posição marcada por `|` no texto. */
function at(text: string): string[] {
  const offset = text.indexOf('|')
  return getCompletions(model, text.replace('|', ''), offset).map((c) => c.label)
}

describe('parseIntrospection', () => {
  it('converte tipos, campos, argumentos e descrições', () => {
    expect(model).not.toBeNull()
    expect(model.queryType).toBe('Query')
    expect(model.mutationType).toBe('Mutation')
    expect(model.subscriptionType).toBeNull()
    const hero = model.types.Query.fields.find((f) => f.name === 'hero')!
    expect(hero.description).toBe('Um herói')
    expect(hero.type).toEqual({ display: 'Character', base: 'Character' })
    expect(hero.args[0]).toMatchObject({ name: 'episode', required: false })
    expect(hero.args[1]).toMatchObject({ name: 'id', required: true })
    expect(model.types.Episode.enumValues.map((e) => e.name)).toEqual(['NEWHOPE', 'EMPIRE'])
  })

  it('escreve tipos com lista e não nulo', () => {
    const users = model.types.Query.fields.find((f) => f.name === 'users')!
    expect(users.type).toEqual({ display: '[User!]!', base: 'User' })
    expect(model.types.Query.fields.find((f) => f.name === 'search')!.deprecated).toBe(true)
  })

  it('recusa entradas sem __schema', () => {
    expect(parseIntrospection({ data: {} })).toBeNull()
    expect(parseIntrospection(null)).toBeNull()
    expect(parseIntrospection({ __schema: { types: [] } })).toBeNull()
  })
})

describe('parseIntrospectionResponse', () => {
  it('aceita a resposta completa', () => {
    expect(parseIntrospectionResponse(JSON.stringify(introspection)).ok).toBe(true)
  })
  it('diz que não é GraphQL quando o texto não é JSON ou não tem o formato', () => {
    expect(parseIntrospectionResponse('<html></html>')).toEqual({ ok: false, code: 'notGraphql' })
    expect(parseIntrospectionResponse('{"hello":"mundo"}')).toEqual({ ok: false, code: 'notGraphql' })
  })
  it('reconhece introspecção recusada', () => {
    expect(parseIntrospectionResponse('{"errors":[{"message":"x"}]}')).toEqual({ ok: false, code: 'introspectionDisabled' })
  })
  it('reconhece schema incompleto', () => {
    expect(parseIntrospectionResponse('{"data":{"__schema":{"types":[]}}}')).toEqual({ ok: false, code: 'invalidSchema' })
  })
})

describe('extractOperations', () => {
  it('lista operações nomeadas e anônimas', () => {
    const ops = extractOperations('query A($x: Int) { a(x: $x) }\nmutation B { b }\nsubscription { c }')
    expect(ops).toEqual([
      { type: 'query', name: 'A' },
      { type: 'mutation', name: 'B' },
      { type: 'subscription', name: null }
    ])
  })
  it('conta a query abreviada e ignora comentários e strings', () => {
    expect(extractOperations('# query Falsa\n{ a(s: "query X { }") }')).toEqual([{ type: 'query', name: null }])
  })
  it('ignora campos chamados query dentro de seleções', () => {
    expect(extractOperations('query Q { query { id } }')).toEqual([{ type: 'query', name: 'Q' }])
  })
})

describe('getCompletions', () => {
  it('sugere os campos da raiz dentro de { }', () => {
    expect(at('{ | }')).toEqual(expect.arrayContaining(['hero', 'users', 'ping', '__typename']))
  })
  it('usa o tipo de mutation depois da palavra-chave', () => {
    expect(at('mutation { | }')).toEqual(['addUser', '__typename'])
  })
  it('segue a pilha de seleções', () => {
    expect(at('query { users { | } }')).toEqual(expect.arrayContaining(['name', 'email', 'friends']))
    expect(at('query { users { name } hero { | } }')).toContain('friends')
    expect(at('query { users { | } }')).not.toContain('hero')
  })
  it('volta ao nível anterior depois de fechar o bloco', () => {
    expect(at('query { users { name } | }')).toContain('hero')
  })
  it('ignora a palavra parcial antes do cursor', () => {
    expect(at('{ hero { na| } }')).toContain('name')
  })
  it('sugere argumentos dentro dos parênteses, sem repetir os já usados', () => {
    expect(at('{ hero(|) }')).toEqual(['episode', 'id'])
    expect(at('{ hero(id: 1, |) }')).toEqual(['episode'])
  })
  it('sugere valores de enum e booleanos depois de dois pontos', () => {
    expect(at('{ hero(episode: |) }')).toEqual(['NEWHOPE', 'EMPIRE'])
    expect(at('{ ping(loud: |) }')).toEqual(['true', 'false'])
  })
  it('volta a sugerir campos depois dos argumentos', () => {
    expect(at('{ hero(episode: EMPIRE) { | } }')).toEqual(expect.arrayContaining(['name', 'friends']))
  })
  it('entende alias e diretivas', () => {
    expect(at('{ h: hero @include(if: true) { | } }')).toContain('friends')
  })
  it('em interface e união sugere os fragmentos por tipo', () => {
    expect(at('{ hero { | } }')).toEqual(expect.arrayContaining(['name', '... on User', '... on Droid']))
    expect(at('{ search { | } }')).toEqual(['__typename', '... on User', '... on Droid'])
  })
  it('depois de "... on" sugere os tipos possíveis e abre o bloco com o tipo certo', () => {
    expect(at('{ hero { ... on | } }')).toEqual(['User', 'Droid'])
    expect(at('{ hero { ... on Droid { | } } }')).toEqual(['primaryFunction', '__typename'])
  })
  it('em fragmento nomeado usa o tipo declarado', () => {
    expect(at('fragment F on User { | }')).toContain('email')
  })
  it('sem contexto sugere as palavras-chave', () => {
    expect(at('|')).toEqual(['query', 'mutation', 'subscription', 'fragment'])
  })
  it('sem schema só sugere as palavras-chave do topo', () => {
    expect(getCompletions(null, '{ ', 2)).toEqual([])
    expect(getCompletions(null, '', 0).map((c) => c.label)).toContain('query')
  })
  it('não quebra com texto torto', () => {
    expect(at('} } ) ] { | ')).toBeInstanceOf(Array)
    expect(at('{ users( { | ')).toBeInstanceOf(Array)
  })
  it('o texto do campo traz argumentos obrigatórios e bloco para tipos compostos', () => {
    const hero = model.types.Query.fields.find((f) => f.name === 'hero')!
    expect(fieldPlainText(model, hero)).toBe('hero(id: ) {\n  \n}')
    const ping = model.types.Query.fields.find((f) => f.name === 'ping')!
    expect(fieldPlainText(model, ping)).toBe('ping')
  })
})
