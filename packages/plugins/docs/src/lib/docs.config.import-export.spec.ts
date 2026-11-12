import {
	DEFAULT_DOCS_IMPORT_MAX_ENTRIES,
	DEFAULT_DOCS_IMPORT_MAX_UNCOMPRESSED_BYTES,
	DEFAULT_DOCS_IMPORT_MAX_ZIP_BYTES,
	DEFAULT_DOCS_PDF_MAX_PAGES,
	ENV_GAUZY_DOCS_IMPORT_ENABLED,
	ENV_GAUZY_DOCS_IMPORT_MAX_ENTRIES,
	ENV_GAUZY_DOCS_IMPORT_MAX_UNCOMPRESSED_BYTES,
	ENV_GAUZY_DOCS_IMPORT_MAX_ZIP_BYTES,
	ENV_GAUZY_DOCS_PDF_EXPORT_ENABLED,
	ENV_GAUZY_DOCS_PDF_MAX_PAGES
} from './docs.constants';
import { getDocsConfig } from './docs.config';

/** The import and PDF export flags are default OFF (`docs-import-export` spec FR-18); their limits have defaults. */
describe('Docs import / PDF export configuration', () => {
	const KEYS = [
		ENV_GAUZY_DOCS_IMPORT_ENABLED,
		ENV_GAUZY_DOCS_IMPORT_MAX_ZIP_BYTES,
		ENV_GAUZY_DOCS_IMPORT_MAX_ENTRIES,
		ENV_GAUZY_DOCS_IMPORT_MAX_UNCOMPRESSED_BYTES,
		ENV_GAUZY_DOCS_PDF_EXPORT_ENABLED,
		ENV_GAUZY_DOCS_PDF_MAX_PAGES
	];
	const saved: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of KEYS) {
			saved[key] = process.env[key];
			delete process.env[key];
		}
	});
	afterEach(() => {
		for (const key of KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	});

	it('keeps both features off, with the documented limits, when nothing is configured', () => {
		const config = getDocsConfig();
		expect(config.importEnabled).toBe(false);
		expect(config.pdfExportEnabled).toBe(false);
		expect(config.importMaxZipBytes).toBe(DEFAULT_DOCS_IMPORT_MAX_ZIP_BYTES);
		expect(config.importMaxEntries).toBe(DEFAULT_DOCS_IMPORT_MAX_ENTRIES);
		expect(config.importMaxUncompressedBytes).toBe(DEFAULT_DOCS_IMPORT_MAX_UNCOMPRESSED_BYTES);
		expect(config.pdfMaxPages).toBe(DEFAULT_DOCS_PDF_MAX_PAGES);
	});

	it('switches each on, and reads the limits', () => {
		process.env[ENV_GAUZY_DOCS_IMPORT_ENABLED] = 'true';
		process.env[ENV_GAUZY_DOCS_PDF_EXPORT_ENABLED] = '1';
		process.env[ENV_GAUZY_DOCS_IMPORT_MAX_ZIP_BYTES] = '1048576';
		process.env[ENV_GAUZY_DOCS_IMPORT_MAX_ENTRIES] = '0';
		process.env[ENV_GAUZY_DOCS_PDF_MAX_PAGES] = '20';
		const config = getDocsConfig();
		expect(config.importEnabled).toBe(true);
		expect(config.pdfExportEnabled).toBe(true);
		expect(config.importMaxZipBytes).toBe(1048576);
		// Zero is not a limit: the default stands.
		expect(config.importMaxEntries).toBe(DEFAULT_DOCS_IMPORT_MAX_ENTRIES);
		expect(config.pdfMaxPages).toBe(20);
	});
});
