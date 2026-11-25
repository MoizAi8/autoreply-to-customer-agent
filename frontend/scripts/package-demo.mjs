import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const target = process.argv[2]
if (!target) throw new Error('Supply a new staging directory for the Vercel demo.')
const source = path.resolve('out')
const landing = await readFile(path.join(source, 'index.html'), 'utf8')
if (!landing.includes('Portfolio demo') || landing.includes('href="/login/')) {
  throw new Error('Build with NEXT_PUBLIC_PORTFOLIO_DEMO=true before packaging.')
}

const output = path.resolve(target, '.vercel', 'output')
const assets = path.join(output, 'static')
await mkdir(assets, { recursive: true })
for (const file of await readdir(source)) {
  if (['index.html', 'index.txt', '404.html', 'demo'].includes(file) || /^__next\..+\.txt$/.test(file)) {
    await cp(path.join(source, file), path.join(assets, file), { recursive: true, errorOnExist: true, force: false })
  }
}
await cp(
  path.join(source, 'demo', '__next.demo', '__PAGE__.txt'),
  path.join(assets, 'demo', '__next.demo.__PAGE__.txt'),
  { errorOnExist: true, force: false },
)
await mkdir(path.join(assets, '_next'), { recursive: true })
await cp(path.join(source, '_next', 'static'), path.join(assets, '_next', 'static'), {
  recursive: true,
  errorOnExist: true,
  force: false,
})

await writeFile(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '/(.*)', headers: { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin' }, continue: true },
    { src: '^/$', dest: '/index.html' },
    { src: '^/demo/?$', dest: '/demo/index.html' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/404.html', status: 404 },
  ],
}, null, 2) + '\n', { flag: 'wx' })
