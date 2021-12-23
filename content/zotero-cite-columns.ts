declare const Zotero: any
// declare const Components: any

const monkey_patch_marker = 'CiteColumnsMonkeyPatched'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function patch(object, method, patcher) {
  if (object[method][monkey_patch_marker]) return
  object[method] = patcher(object[method])
  object[method][monkey_patch_marker] = true
}

function nsResolver(prefix) {
  const csl = 'http://purl.org/net/xbiblio/csl'
  return {
    xhtml : 'http://www.w3.org/1999/xhtml',
    csl,
  }[prefix] || csl
}

async function columns() {
  try {
    const path = OS.Path.join(Zotero.DataDirectory.dir, 'styles', 'zotero-cite-columns.csl')

    if (!(await OS.File.exists(path))) {
      flash('Style not found', path + ' not found')
      return []
    }

    const domParser = new DOMParser
    const children = style.evaluate('count(//csl:citation/csl:layout/*)', style, prefix => 'http://purl.org/net/xbiblio/csl', XPathResult.NUMBER_TYPE, null).numberValue
    if (children !== 1) {
      flash('failed to load column style', `//citation/layout should have exactly one child, found ${children}`)
      return []
    }

    const group = document.evaluate('//csl:citation/csl:layout/csl:group', style, prefix => 'http://purl.org/net/xbiblio/csl', XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue

  }
  catch (err) {
    flash('failed to load column style', err.message)
    return []
  }
}

class CiteColumns { // tslint:disable-line:variable-name
  private initialized = false
  private globals: Record<string, any>
  private strings: any

  // eslint-disable-next-line @typescript-eslint/require-await
  public async load(globals: Record<string, any>) {
    this.globals = globals

    if (this.initialized) return
    this.initialized = true

    this.strings = globals.document.getElementById('zotero-cite-columns-strings')

    await Zotero.Schema.schemaUpdatePromise

    const path = OS.Path.join(Zotero.DataDirectory.dir, 'styles', 'zotero-cite-columns.csl')
    let columns = 0
    if (!(await OS.File.exists(path))) {
      flash('Style not found', path + ' not found')
    } else {
      try {
      const style = domParser.parseFromString(await OS.File.read(path, { encoding: 'utf-8' }) as unknown as string)
      let groups = style.evaluate('count(//citation/layout/*)', style, prefix => 'http://purl.org/net/xbiblio/csl', XPathResult.ANY_TYPE, null)
      if (groups.numberValue !== 1) {
        flash('
      }
      else {
      }
    }
      const xpathResult = document.evaluate( xpathExpression, contextNode, namespaceResolver, resultType, result );





      <citation et-al-min="3" et-al-use-first="1" disambiguate-add-year-suffix="true" disambiguate-add-names="true" disambiguate-add-givenname="true" collapse="year" givenname-disambiguation-rule="primary-name">
    <sort>
      <key macro="author-bib" names-min="3" names-use-first="1"/>
      <key macro="date-sort-group"/>
      <key macro="date-sort-date" sort="ascending"/>
      <key variable="status"/>
    </sort>
    <layout delimiter=" ">
      <group delimiter="|">

  }
}

Zotero.CiteColumns = new CiteColumns
