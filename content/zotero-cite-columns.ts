declare const Zotero: any
declare const OS: any

// declare const Components: any

import { flash } from './flash'
import { debug } from './debug'

const monkey_patch_marker = 'CiteColumnsMonkeyPatched'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function patch(object, method, patcher) {
  if (object[method][monkey_patch_marker]) return
  object[method] = patcher(object[method])
  object[method][monkey_patch_marker] = true
}

type ColumnSpec = {
  delimiter: string
  labels: string[]
}

const fieldPrefix = 'cite-column-'
const styleName = 'zotero-cite-columns'
const styleId = `http://www.zotero.org/styles/${styleName}`

function xpathOne(doc, query): Element {
  const nodes: Element[] = Zotero.Utilities.xpath(doc, query, Zotero.Styles.ns)
  query = query.replace(/\/csl:/g, '/')
  switch (nodes.length) {
    case 0: throw new Error(`${query} not found`)
    case 1: return nodes[0]
    default: throw new Error(`expected 1 ${query}, found ${nodes.length}`)
  }
}

async function colSpec(): Promise<ColumnSpec> {
  function notfound(msg) { // eslint-disable-line prefer-arrow/prefer-arrow-functions
    flash('failed to load column style', msg)
    return { delimiter: '', labels: [] }
  }

  try {
    const file = OS.Path.join(Zotero.DataDirectory.dir, `${styleName}.csl`)

    if (!(await OS.File.exists(file))) return notfound(`${file} not found`)

    const domParser = new DOMParser
    const doc = domParser.parseFromString(Zotero.File.getContents(file), 'application/xml') as XMLDocument

    const id = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info/csl:id', Zotero.Styles.ns)
    if (id !== styleId) return notfound(`style ID must be ${styleId}, found ${id}`)

    const layout = xpathOne(doc, '/csl:style/csl:citation/csl:layout')
    if (layout.children.length !== 1 || layout.children[0].localName !== 'group') return notfound('layout should have exactly one child, which must be a group')

    const group = layout.children[0]
    const delimiter = group.getAttribute('delimiter')
    if (!delimiter) return notfound('/style/citation/layout/group must have a delimiter')

    const labels: string[] = Array.from(group.children).map(child => {
      const macro: string = child.getAttribute('macro')
      if (child.localName !== 'text' || !macro) throw new Error(`expected /style/citation/layout/group/text/@macro, found /style/citation/layout/group/${child.localName}@${macro}`)
      return macro.replace(/_/g, ' ')
    })

    await Zotero.Styles.install({ file }, styleId, true)

    return {
      delimiter,
      labels,
    }
  }
  catch (err) {
    return notfound(err.message)
  }
}

const pending: Set<number> = new Set
// To show the cite-column in the reference list
patch(Zotero.Item.prototype, 'getField', original => function Zotero_Item_prototype_getField(field: string, unformatted: boolean, includeBaseMapped: boolean) {
  try {
    if (field.startsWith(fieldPrefix)) {
      if (!this.isRegularItem()) return ''

      if (!Zotero.CiteColumns?.citeproc) {
        debug('getField: pending', field)
        pending.add(this.id)
        return ''
      }

      let cite = Zotero.CiteColumns.cites[this.id]
      debug('getField', field, cite)
      if (!cite || cite.dateModified !== this.dateModified) {
        Zotero.CiteColumns.citeproc.updateItems([this.id])

        const citation = {
          citationItems: [{ id: this.id }],
          properties: {},
        }

        cite = Zotero.CiteColumns.cites[this.id] = {
          dateModified: this.dateModified,
          fields: Zotero.CiteColumns.citeproc.previewCitationCluster(citation, [], [], 'text').split(Zotero.CiteColumns.columns.delimiter),
        }
      }
      debug('getField', field, cite)

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
  private columns: ColumnSpec
  public cites: Record<number, { dateModified: string, fields: string[] }> = {}
  public citeproc: any
  public pending: Set<number> = new Set
  private cache: string

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

      this.cache = OS.Path.join(Zotero.DataDirectory.dir, `${styleName}.json`)
      if ((await OS.File.exists(this.cache))) {
        try {
          this.cites = JSON.parse(Zotero.File.getContents(this.cache))
        }
        catch (err) {
          flash('failed to load cache', `${this.cache}: ${err.message}`)
          this.cites = {}
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
      const file = Zotero.File.pathToFile(this.cache)
      Zotero.File.putContents(file, JSON.stringify(this.cites))
    }
  }
}

Zotero.CiteColumns = new CiteColumns
