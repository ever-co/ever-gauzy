import { getDocsConfig } from '../docs.config';
import { DOCS_IMPORT_MAX_RATIO, DOCS_IMPORT_RATIO_MIN_BYTES } from '../docs.constants';
import type { IImportArchiveLimits } from './import-archive';

/** The archive limits of this installation (`GAUZY_DOCS_IMPORT_*`, plus the fixed bomb ratio). */
export function importArchiveLimits(): IImportArchiveLimits {
	const config = getDocsConfig();
	return {
		maxEntries: config.importMaxEntries,
		maxUncompressedBytes: config.importMaxUncompressedBytes,
		maxRatio: DOCS_IMPORT_MAX_RATIO,
		ratioMinBytes: DOCS_IMPORT_RATIO_MIN_BYTES
	};
}
