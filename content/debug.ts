/* eslint-disable  @typescript-eslint/no-unsafe-return */
declare const Zotero: any

function to_s(obj: any): string {
  if (typeof obj === 'string') return obj
  const s = `${obj}`
  return s === '[object Object]' ? JSON.stringify(obj) : s
}

export function debug(...msg): void {
  const str = `Cite Columns: ${msg.map(to_s).join(' ')}`
  // console.error(str) // tslint:disable-line:no-console
  Zotero.debug(str)
}
