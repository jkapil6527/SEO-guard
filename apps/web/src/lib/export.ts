/**
 * Client-side exports. JSON and CSV are generated from already-loaded data and
 * downloaded in the browser (no server round-trip). CSV opens directly in Excel,
 * covering the spreadsheet case; PDF is produced via the browser's print dialog
 * ("Save as PDF") from a print-friendly view.
 */

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportJson(data: unknown, filename: string): void {
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `${filename}.json`,
  );
}

/** Neutralizes CSV formula-injection and quotes fields safely. */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function exportCsv(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  filename: string,
): void {
  const header = columns.map(csvCell).join(',');
  const body = rows.map((row) => columns.map((col) => csvCell(row[col])).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

/** Opens the browser print dialog — the user chooses "Save as PDF". */
export function exportPdf(): void {
  window.print();
}
