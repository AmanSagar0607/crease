/** Encode untrusted values for spreadsheets, including formula-injection protection. */
export function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRows(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
