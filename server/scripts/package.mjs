// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
// Gera o pacote de instalação da API em release/: compila o TypeScript e junta os arquivos do instalador.
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const name = `meu-editor-api-${pkg.version}`
const release = join(root, 'release')
const out = join(release, name)
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' })

rmSync(join(root, 'dist'), { recursive: true, force: true })
rmSync(release, { recursive: true, force: true })
run('npx tsc -p tsconfig.build.json')
cpSync(join(root, 'src/db/schema.sql'), join(root, 'dist/db/schema.sql'))

mkdirSync(out, { recursive: true })
cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true })
for (const f of ['server.js', 'server.cjs', 'install.sh', 'uninstall.sh', 'meu-editor-api.service', 'api.env.example', 'nginx-meu-editor-api.conf', 'INSTALL.md', 'INSTALL.pt-BR.md']) {
  cpSync(join(root, 'installer', f), join(out, f))
}

// package.json enxuto: só dependências de produção e scripts que rodam o JavaScript compilado.
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  description: pkg.description,
  type: 'module',
  main: 'server.js',
  engines: { node: '>=22' },
  scripts: { start: 'node server.js', migrate: 'node dist/migrate.js' },
  dependencies: pkg.dependencies
}
writeFileSync(join(out, 'package.json'), JSON.stringify(prodPkg, null, 2) + '\n')
cpSync(join(root, 'package-lock.json'), join(out, 'package-lock.json'))
// Lockfile coerente com o package.json enxuto (npm ci exige os dois em acordo).
run('npm install --package-lock-only --omit=dev --no-audit --no-fund', out)

run(`tar -czf ${name}.tar.gz ${name}`, release)
// No Windows, o tar do sistema (bsdtar) gera .zip; o GNU tar não.
const zipTar = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'bsdtar'
run(`"${zipTar}" -a -cf ${name}.zip ${name}`, release)
console.log(`\nPacotes gerados em release/: ${name}.tar.gz e ${name}.zip`)
