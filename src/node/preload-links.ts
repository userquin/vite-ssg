import { ManifestChunk } from 'vite'
import { Manifest, SSRManifest } from './build'

type DepPreloadLink = string | {
  file: string
  type: 'css' | 'other'
  replace?: boolean
  defer?: boolean // <== add external options on ssgOptions, similar to 'sync' and 'async'
}

function addDeps(base: string, preloadLinks: DepPreloadLink[], entry: ManifestChunk) {
  if (entry.css) {
    entry.css.forEach((c) => {
      preloadLinks.push({
        file: c.startsWith('/') ? c : `${base}${c}`,
        type: 'css',
        defer: true,
      })
    })
  }
  if (entry.assets) {
    entry.assets.forEach((a) => {
      preloadLinks.push({
        file: a.startsWith('/') ? a : `${base}${a}`,
        type: 'other',
      })
    })
  }
}

function lookupIndexHtmlEntries(manifest: Manifest): {
  file: string | undefined
  css: string[] | undefined
} {
  const entry = Array.from(Object.values(manifest)).filter((v) => {
    return v.isEntry
  })

  const result = { file: undefined, css: undefined }

  if (entry) {
    result.file = entry[0].file as any
    result.css = entry[0].css as any
  }
  return result
}

export function renderPreloadLinks(base: string, document: Document, modules: Set<string>, ssrManifest: SSRManifest, manifest: Manifest) {
  const seen = new Set()

  const preloadLinks: DepPreloadLink[] = []

  // preload modules
  Array.from(modules).forEach((id) => {
    const files = ssrManifest[id] || []
    files.forEach((file) => {
      if (!preloadLinks.includes(file))
        preloadLinks.push(file)
    })
  })

  Array.from(modules).forEach((id) => {
    const entry = manifest[id]
    if (entry) {
      // add modulepreload for main module
      const { file, css } = lookupIndexHtmlEntries(manifest)
      if (file) {
        const name = file.startsWith('/') ? file : `${base}${file}`
        if (!preloadLinks.includes(name))
          preloadLinks.push(name)
      }
      // replace/add all css entries with nonblocking one
      if (css) {
        css.forEach((c) => {
          preloadLinks.push({
            file: c.startsWith('/') ? c : `${base}${c}`,
            type: 'css',
            defer: true,
            replace: true,
          })
        })
      }

      // add all its dependencies
      if (entry.isDynamicEntry) {
        if (entry.file) {
          const entryName = entry.file.startsWith('/') ? entry.file : `${base}${entry.file}`
          if (!preloadLinks.includes(entryName))
            preloadLinks.push(entryName)
        }
        if (entry.imports) {
          Object.keys(manifest).filter(e => entry.imports?.includes(e)).forEach((c) => {
            const dep = manifest[c]
            if (dep && (!dep.isEntry || !dep.isDynamicEntry)) {
              if (dep.file) {
                const depName = dep.file.startsWith('/') ? dep.file : `${base}${dep.file}`
                if (!preloadLinks.includes(depName))
                  preloadLinks.push(depName)
              }
              addDeps(base, preloadLinks, dep)
            }
          })
        }
        addDeps(base, preloadLinks, entry)
      }
    }
  })

  if (preloadLinks) {
    preloadLinks.forEach((link) => {
      const file = typeof link === 'string' ? link : link.file
      if (!seen.has(file)) {
        seen.add(file)
        renderPreloadLink(document, link)
      }
    })
  }
}

const createLink = (document: Document) => document.createElement('link')

const setAttrs = (el: Element, attrs: Record<string, any>) => {
  const keys = Object.keys(attrs)
  for (const key of keys)
    el.setAttribute(key, attrs[key])
}

function renderPreloadLink(document: Document, link: DepPreloadLink) {
  if (typeof link === 'string') {
    const file = link
    if (file.endsWith('.js')) {
      appendLink(document, {
        rel: 'modulepreload',
        crossOrigin: '',
        href: file,
      })
    }
    else if (file.endsWith('.css')) {
      appendLink(document, {
        rel: 'stylesheet',
        href: file,
      })
    }
  }
  else {
    const { file, type, replace = false, defer } = link
    if (type === 'css') {
      const link = appendLink(document, {
        rel: 'preload',
        as: 'style',
        onload: 'this.onload=null;this.rel=\'stylesheet\'',
        href: file,
      }, replace)
      if (link) {
        const noScript = document.createElement('noscript')
        const noScriptLink = createLink(document)
        setAttrs(noScriptLink, {
          rel: 'stylesheet',
          href: file,
        })
        noScript.appendChild(noScriptLink)
        document.head.appendChild(noScript)
      }
    }
    else {
      appendLink(document, {
        rel: 'prefetch',
        href: file,
      }, replace)
    }
  }
}

function appendLink(document: Document, attrs: Record<string, any>, replace = false) {
  const exists = document.head.querySelector(`link[href='${attrs.href}']`)
  if (exists && !replace) return undefined
  const link = createLink(document)
  setAttrs(link, attrs)
  if (exists)
    document.head.replaceChild(link, exists)
  else
    document.head.appendChild(link)
  return link
}
