import { randomUUID } from 'node:crypto';
import * as moment from 'moment';

/**
 * The name an upload is stored under when its caller names none: `<prefix>-<unix seconds>-<random uuid>[.<extension>]`.
 *
 * It was `<prefix>-<unix seconds>-<0..999>`, about ten bits of guessing per second of upload time, and the local
 * provider serves its directory without authentication at `/public/`: an employee's screenshots, stored under
 * `screenshots/<date>/<tenantId>/<employeeId>/`, could be found by trying a thousand names per second of a work day
 * (the import archive got its own random name for the same reason, see `import-archive-file-name.ts`). The timestamp is
 * kept so names still sort by upload time.
 *
 * @param prefix - The upload's kind (`screenshots`, `image-assets`, ...).
 * @param extension - The extension to append, if any.
 * @returns The file name.
 */
export function defaultStoredFileName(prefix: string, extension?: string): string {
	const name = `${prefix}-${moment().unix()}-${randomUUID()}`;
	return extension ? `${name}.${extension}` : name;
}
