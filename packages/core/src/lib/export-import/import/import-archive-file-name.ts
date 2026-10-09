import { randomUUID } from 'node:crypto';

/**
 * Storage file name for an uploaded import archive: `.import-<random uuid>.zip`.
 *
 * 🛑 The archive is a full tenant data dump, and it is KEPT after the import so the Import page can
 * offer it for download again (`GET /import/history/:id/download`). The storage providers' default
 * name is `import-<unix-seconds>-<0..999>.zip`, about ten bits of guessing per second of upload time,
 * and the local provider writes it under the directory `ServeStaticModule` publishes without
 * authentication at `/public/` — so anybody could enumerate and download other tenants' dumps.
 *
 * Two independent properties close that:
 *
 * - **Unguessable.** 122 random bits. The key is never returned by the API either:
 *   `ImportHistory.path` is `@Exclude`d and no public URL is derived from it any more.
 * - **Not served.** The leading dot makes it a dotfile, which `serve-static` answers with 404 by
 *   default for the last path segment, so the local provider's copy is not reachable over `/public/`
 *   even by somebody who has the name. Cloud providers keep their buckets private and sign URLs.
 *
 * The extension is fixed rather than copied from the client's name; `archiveUploadFileFilter` has
 * already refused anything that is not a ZIP.
 *
 * @returns The file name to store the upload under.
 */
export function generateImportArchiveFileName(): string {
	return `.import-${randomUUID()}.zip`;
}
