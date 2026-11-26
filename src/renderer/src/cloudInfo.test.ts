// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { formatTotalMb } from './cloudInfo'

describe('formatTotalMb', () => {
  it('soma os tamanhos e usa 2 casas decimais', () => {
    expect(formatTotalMb([{ size: 1048576 }, { size: 262144 }], 'en')).toBe('1.25')
    expect(formatTotalMb([{ size: 1310720 }], 'pt-BR')).toBe('1,25')
  })
  it('lista vazia dá zero', () => {
    expect(formatTotalMb([], 'en')).toBe('0.00')
  })
})
