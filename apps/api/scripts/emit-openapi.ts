import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import app from '../src/index.js'

/**
 * Writes the OpenAPI document to disk so codegen does not need a running Worker.
 *
 * `openapi.json` is committed. That makes client/server drift visible in review — a route
 * change that alters the contract shows up as a spec diff in the same commit, rather than
 * being discovered later when someone regenerates.
 */
const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '../openapi.json')

const document = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: { title: 'Fillaform API', version: '0.1.0' },
})

writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`)
console.log(`wrote ${outPath}`)
