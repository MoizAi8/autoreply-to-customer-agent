import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const source = path.resolve(process.argv[2] ?? 'out')
const project = process.argv[3]
if (!project) throw new Error('Provide the Vercel staging project directory.')
await stat(path.join(source, 'index.html'))
const output = path.resolve(project, '.vercel', 'output')
await mkdir(output)
const assets = path.join(output, 'static')
await cp(source, assets, { recursive: true })

const routes = []
for (const entry of await readdir(source, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue
  const pathname = path.relative(source, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
  if (entry.name === 'index.html') {
    const route = pathname.slice(0, -'index.html'.length)
    if (route) routes.push({ src: '/' + route.slice(0, -1) + '/?', dest: '/' + pathname })
    else routes.push({ src: '/', dest: '/index.html' })
  }
  const segment = pathname.indexOf('__next.')
  if (segment >= 0 && pathname.endsWith('.txt') && pathname.slice(segment).includes('/')) {
    const alias = pathname.slice(0, segment) + pathname.slice(segment).replaceAll('/', '.')
    await cp(path.join(source, pathname), path.join(assets, alias))
  }
}

await writeFile(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [{ handle: 'filesystem' }, ...routes, { src: '/.*', status: 404, dest: '/404.html' }],
}, null, 2))
