import 'reflect-metadata';
import { isExportSkipped, SKIP_EXPORT_METADATA, SkipExport, skipExport } from './skip-export.decorator';

/**
 * The export-archive opt-out for derived plugin data (`02-domain-model.md` §15/§20,
 * `08-permissions-security.md` §10.3/§11). Both spellings of the marker have to agree, and — the
 * point of the whole seam — an entity must NEVER be excluded by accident: default is "exported",
 * and inheriting from an excluded entity does not carry the exclusion along.
 */
describe('SkipExport', () => {
	it('is opt-in — an unmarked entity is exported', () => {
		class Document {}

		expect(isExportSkipped(Document)).toBe(false);
	});

	it('marks a decorated entity', () => {
		@SkipExport()
		class DocumentChunk {}

		expect(isExportSkipped(DocumentChunk)).toBe(true);
		expect(Reflect.getOwnMetadata(SKIP_EXPORT_METADATA, DocumentChunk)).toBe(true);
	});

	it('marks entities passed to the imperative form, for composition roots', () => {
		class DocumentChunk {}
		class DocumentIndexState {}
		class Document {}

		skipExport(DocumentChunk, DocumentIndexState);

		expect(isExportSkipped(DocumentChunk)).toBe(true);
		expect(isExportSkipped(DocumentIndexState)).toBe(true);
		expect(isExportSkipped(Document)).toBe(false);
	});

	it('does NOT leak the exclusion to a subclass', () => {
		// A plugin entity extending an excluded one would otherwise vanish from archives silently.
		@SkipExport()
		class DerivedData {}
		class AuthoredRecord extends DerivedData {}

		expect(isExportSkipped(DerivedData)).toBe(true);
		expect(isExportSkipped(AuthoredRecord)).toBe(false);
	});

	it('ignores non-class values instead of throwing', () => {
		expect(isExportSkipped(undefined as unknown as Function)).toBe(false);
		expect(() => skipExport(null as unknown as Function)).not.toThrow();
	});
});
