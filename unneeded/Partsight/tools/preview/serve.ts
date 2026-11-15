// Builds the preview bundle and serves it. Run from repo root: bun Partsight/tools/preview/serve.ts
import {join} from "path"

const here = import.meta.dir
const meshes = join(here, "..", "..", "Assets", "Partsight", "Meshes")
const port = Number(process.env.PORT || 5317)

async function build() {
  const out = await Bun.build({
    entrypoints: [join(here, "main.ts")],
    external: ["three", "three/*"],
    format: "esm",
    target: "browser"
  })
  if (!out.success) throw new Error(out.logs.map(String).join("\n"))
  return await out.outputs[0].text()
}

let bundle = await build()
Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === "/" || url.pathname === "/index.html") return new Response(Bun.file(join(here, "index.html")))
    if (url.pathname === "/main.js") {
      bundle = await build()
      return new Response(bundle, {headers: {"content-type": "text/javascript"}})
    }
    if (url.pathname.startsWith("/meshes/")) return new Response(Bun.file(join(meshes, url.pathname.slice(8))))
    return new Response("not found", {status: 404})
  }
})
console.log(`Partsight preview on http://localhost:${port}`)
