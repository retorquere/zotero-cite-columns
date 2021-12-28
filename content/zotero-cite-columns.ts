declare const Zotero: any
declare const OS: any
declare const Components: any

import murmur from 'murmur-hash-js'

import { flash } from './flash'
import { debug } from './debug'

const monkey_patch_marker = 'CiteColumnsMonkeyPatched'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function patch(object, method, patcher) {
  if (object[method][monkey_patch_marker]) return
  object[method] = patcher(object[method])
  object[method][monkey_patch_marker] = true
}

const fieldPrefix = 'cite-column-'
const styleName = 'zotero-cite-columns'
const styleId = `http://www.zotero.org/styles/${styleName}`
const delimiter = '@@'

function xpathOne(doc, query): Element {
  const nodes: Element[] = Zotero.Utilities.xpath(doc, query, Zotero.Styles.ns)
  query = query.replace(/\/csl:/g, '/')
  switch (nodes.length) {
    case 0: throw new Error(`${query} not found`)
    case 1: return nodes[0]
    default: throw new Error(`expected 1 ${query}, found ${nodes.length}`)
  }
}

type ColSpec = {
  labels: string[]
  hash?: number
}
async function colSpec(): Promise<ColSpec> {
  function notfound(msg: string): ColSpec { // eslint-disable-line prefer-arrow/prefer-arrow-functions
    flash('failed to load column style', msg)
    return { labels: [] }
  }

  try {
    const path = OS.Path.join(Zotero.DataDirectory.dir, `${styleName}.csl`)

    if (!(await OS.File.exists(path))) return notfound(`${path} not found`)

    const domParser = new DOMParser
    const doc = domParser.parseFromString(Zotero.File.getContents(path) as string, 'application/xml') as XMLDocument

    const id = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info/csl:id', Zotero.Styles.ns)
    if (id !== styleId) return notfound(`style ID must be ${styleId}, found ${id}`)

    const layout = xpathOne(doc, '/csl:style/csl:citation/csl:layout')
    if (layout.children.length !== 1 || layout.children[0].localName !== 'group') return notfound('layout should have exactly one child, which must be a group')

    const group = layout.children[0]
    group.setAttribute('delimiter', delimiter)

    const labels: string[] = Array.from(group.children).map(child => {
      const macro: string = child.getAttribute('macro')
      if (child.localName !== 'text' || !macro) throw new Error(`expected /style/citation/layout/group/text/@macro, found /style/citation/layout/group/${child.localName}@${macro}`)
      return macro.replace(/_/g, ' ')
    })

    const style = Components.classes['@mozilla.org/xmlextras/xmlserializer;1'].createInstance(Components.interfaces.nsIDOMSerializer).serializeToString(doc)
    debug('style:', style)
    await Zotero.Styles.install({ string: style }, styleId, true) // eslint-disable-line id-blacklist

    return { labels, hash: murmur(style) }
  }
  catch (err) {
    return notfound(err.message) // eslint-disable-line @typescript-eslint/no-unsafe-argument
  }
}

// To show the cite-column in the reference list
patch(Zotero.Item.prototype, 'getField', original => function Zotero_Item_prototype_getField(field: string, unformatted: boolean, includeBaseMapped: boolean) {
  try {
    if (field.startsWith(fieldPrefix)) {
      if (!this.isRegularItem()) return ''

      if (!Zotero.CiteColumns?.citeproc) {
        debug('getField: pending', field)
        return ''
      }

      let cite = Zotero.CiteColumns.cache.item[this.id]
      debug('getField:', field, cite, this.dateModified)
      if (!cite || cite.dateModified !== this.dateModified) {
        Zotero.CiteColumns.citeproc.updateItems([this.id])

        const citation = {
          citationItems: [{ id: this.id }],
          properties: {},
        }

        const text = Zotero.CiteColumns.citeproc.previewCitationCluster(citation, [], [], 'text')
        debug('pre-split:', JSON.stringify(text))

        cite = Zotero.CiteColumns.cache.item[this.id] = {
          dateModified: this.dateModified,
          fields: text.split(delimiter),
        }
      }
      debug('getField:', field, cite)

      const index = parseInt(field.substring(fieldPrefix.length))
      return cite.fields[index] || '' // eslint-disable-line @typescript-eslint/no-unsafe-return
    }
  }
  catch (err) {
    debug('patched getField:', field, unformatted, includeBaseMapped, err.message)
    return ''
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, prefer-rest-params
  return original.apply(this, arguments) as string
})

class CiteColumns { // tslint:disable-line:variable-name
  private initialized = false
  private ready = false
  private globals: Record<string, any>
  private strings: any
  private columns: ColSpec
  public citeproc: any
  public cache: { path: string, hash: number, item: Record<number, { dateModified: string, fields: string[] }> }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async load(globals: Record<string, any>) {
    this.globals = globals

    if (this.initialized) return
    this.initialized = true

    this.strings = globals.document.getElementById('zotero-cite-columns-strings')

    await Zotero.Schema.schemaUpdatePromise

    this.columns = await colSpec()
    debug(this.columns)

    const treecols = this.globals.document.getElementById('zotero-items-columns-header')
    for (const [i, label] of this.columns.labels.entries()) {
      const treecol = treecols.appendChild(this.globals.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'treecol'))
      treecol.setAttribute('id', `zotero-items-column-${fieldPrefix}${i}`)
      treecol.setAttribute('label', label)
      treecol.setAttribute('flex', '1')
      treecol.setAttribute('zotero-persist', 'width ordinal hidden sortActive sortDirection')
    }

    if (this.columns.labels.length) {
      const locale = Zotero.Prefs.get('export.quickCopy.locale')
      this.citeproc = Zotero.Styles.get(styleId).getCiteProc(locale)

      const cache = OS.Path.join(Zotero.DataDirectory.dir, `${styleName}.json`)
      if ((await OS.File.exists(cache))) {
        try {
          this.cache = { ...JSON.parse(Zotero.File.getContents(this.cache)), path: cache } // eslint-disable-line @typescript-eslint/no-unsafe-argument
          if (this.cache.hash !== this.columns.hash) throw new Error(`cache hash mismatch, found ${this.cache.hash}, expected ${this.columns.hash}`)
        }
        catch (err) {
          flash('failed to load cache', `${cache}: ${err.message}`)
          this.cache = { path: cache, hash: this.columns.hash, item: {} }
        }
      }

      const view = Zotero.getActiveZoteroPane().itemsView
      if (typeof Zotero.ItemTreeView === 'undefined') {
        view.refreshAndMaintainSelection()
      }
      else {
        await view.refresh()
      }

      Zotero.addShutdownListener(() => this.save())
    }
  }

  private save() {
    if (this.cache) {
      const file = Zotero.File.pathToFile(this.cache.path)
      Zotero.File.putContents(file, JSON.stringify({ ...this.cache, path: undefined }))
    }
  }
}

Zotero.CiteColumns = new CiteColumns
