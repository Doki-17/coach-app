/** Turns any human-entered string into a safe, readable filename segment. */
function slugifyForFilename(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'Untitled';
}

/** Builds a `ClientName_ProgramTitle_Date.ext` filename for program exports. */
export function buildExportFilename(clientName: string, programTitle: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, filename-safe
  return `${slugifyForFilename(clientName)}_${slugifyForFilename(programTitle)}_${date}.${extension}`;
}
