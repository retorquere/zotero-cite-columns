declare const Zotero: any

import { debug } from './debug'

const seconds = 1000

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
export function flash(title: string, body?: string, timeout = 8): void {
  try {
    debug('flash:', {title, body})
    const pw = new Zotero.ProgressWindow()
    pw.changeHeadline(`Cite Columns: ${title}`)
    if (!body) body = title
    if (Array.isArray(body)) body = body.join('\n')
    pw.addDescription(body)
    pw.show()
    pw.startCloseTimer(timeout * seconds)
  }
  catch (err) {
    debug('flash failed:', {title, body}, err.message)
  }
}
