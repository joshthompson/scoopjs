// Serves the stress page, and the files it imports, from the repo root.
// Plain Node, so the page needs nothing installed beyond what Core is built
// with. It listens on localhost unless `HOST` says otherwise, as it must for
// a phone to reach it.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = Number(process.env.PORT ?? 5180)
const host = process.env.HOST ?? '127.0.0.1'

const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.map': 'application/json',
}

const server = createServer(async (request, response) => {
	const url = new URL(request.url ?? '/', 'http://localhost')
	const path = decodeURIComponent(url.pathname)
	// The page is in bench/, and imports Core and Solid from elsewhere in the
	// repo, so it's served from there rather than from the root
	if (path === '/') {
		response.writeHead(302, { Location: `/bench/${url.search}` }).end()
		return
	}
	// Nothing outside the repo, however the path is written
	const file = normalize(
		join(root, path.endsWith('/') ? `${path}index.html` : path),
	)
	if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
		response.writeHead(403).end()
		return
	}
	try {
		if (!(await stat(file)).isFile()) throw new Error('not a file')
	} catch {
		response.writeHead(404).end('Not found')
		return
	}
	response.writeHead(200, {
		'Content-Type': types[extname(file)] ?? 'application/octet-stream',
		'Cache-Control': 'no-store',
	})
	createReadStream(file).pipe(response)
})

server.listen(port, host, () => {
	console.log(`Stress page: http://localhost:${port}/bench/`)
})
