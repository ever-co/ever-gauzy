/**
 * Regression cover for the *shape* of the request DTOs, which is where two defects lived:
 *
 * - `UpdateDocumentDTO` still accepted `parentId`/`index`, so `PUT /documents/:id` re-parented a
 *   node through `buildAssignableFields` — bypassing the cycle guard and the FILE-parent check
 *   of the guarded `POST /:id/move`. With the fields omitted, `forbidNonWhitelisted` turns that
 *   request into a 400.
 * - `GetDocumentLinksQueryDTO` / the settings query carried no organization at all, so the
 *   endpoints fell back to whatever the service assumed. They now inherit the platform's
 *   organization-ownership check.
 *
 * `@gauzy/core` boots the whole application graph on import, so its DTO base is stubbed with a
 * plain class here; the assertions are about what the *plugin's* DTOs declare on top of it.
 */
jest.mock(
	'@gauzy/core',
	() => {
		const { IsOptional, IsUUID } = jest.requireActual('class-validator');
		class TenantOrganizationBaseDTO {
			organizationId?: string;
		}
		IsOptional()(TenantOrganizationBaseDTO.prototype, 'organizationId');
		IsUUID()(TenantOrganizationBaseDTO.prototype, 'organizationId');
		return { TenantOrganizationBaseDTO, BaseQueryDTO: class {} };
	},
	{ virtual: true }
);

import { getMetadataStorage } from 'class-validator';
import { DocumentSettingsQueryDTO } from './document-settings.dto';
import { GetDocumentLinksQueryDTO } from './document-link.dto';
import { UpdateDocumentContentDTO, UpdateDocumentContentMetadataDTO } from './update-document-content.dto';
import { UpdateDocumentDTO } from './update-document.dto';
import { UploadDocumentsDTO } from './upload-documents.dto';

/** Every property class-validator knows about for a DTO, inherited members included. */
const validatedPropertiesOf = (target: any): string[] => [
	...new Set(
		getMetadataStorage()
			.getTargetValidationMetadatas(target, '', true, false)
			.map((metadata: any) => metadata.propertyName)
	)
];

describe('UpdateDocumentDTO — re-parenting is not a metadata update', () => {
	it('does not declare parentId or index (moves go through POST /:id/move)', () => {
		const properties = validatedPropertiesOf(UpdateDocumentDTO);

		expect(properties).not.toContain('parentId');
		expect(properties).not.toContain('index');
	});

	it('still declares the metadata fields it is responsible for', () => {
		const properties = validatedPropertiesOf(UpdateDocumentDTO);

		expect(properties).toEqual(expect.arrayContaining(['name', 'searchable', 'isLocked', 'summary']));
	});

	it('still omits the immutable and content fields', () => {
		const properties = validatedPropertiesOf(UpdateDocumentDTO);

		for (const omitted of ['kind', 'contentJson', 'contentHtml', 'importToKnowledge']) {
			expect(properties).not.toContain(omitted);
		}
	});
});

/**
 * The upload route validates with `whitelist: true`: a field the DTO does not declare is
 * stripped in silence, so the control that collected it does nothing and nothing tells
 * anyone. That is precisely how the classification dialog's "Classify with AI" toggle came
 * to be decorative — the client offered the choice, the DTO had no `classifyWithAi`, and
 * every upload classified according to the org default regardless.
 */
describe('UploadDocumentsDTO — every dialog toggle is a declared field', () => {
	it('declares both classification toggles (whitelist: true drops anything else)', () => {
		const properties = validatedPropertiesOf(UploadDocumentsDTO);

		expect(properties).toEqual(expect.arrayContaining(['classifyWithAi', 'importToKnowledge']));
	});

	it('still declares the rest of the dialog surface', () => {
		const properties = validatedPropertiesOf(UploadDocumentsDTO);

		expect(properties).toEqual(
			expect.arrayContaining(['parentId', 'visibility', 'categoryIds', 'tagIds', 'source'])
		);
	});
});

/**
 * The same `whitelist: true` trap on the content route: the editor stamps
 * `metadata.schemaVersion` on every save and (P6) sends the CRDT state, and both are dropped in
 * silence unless the DTO declares them. `metadata` is a NESTED DTO on purpose — an open object
 * would let an autosave replace the row's `ai`/`migration`/`review` provenance.
 */
describe('UpdateDocumentContentDTO — the editor payload is fully declared', () => {
	it('declares the content, concurrency and sync fields', () => {
		expect(validatedPropertiesOf(UpdateDocumentContentDTO)).toEqual(
			expect.arrayContaining([
				'contentJson',
				'contentHtml',
				'contentBinary',
				'expectedUpdatedAt',
				'forceSnapshot',
				'mentionEmployeeIds',
				'metadata'
			])
		);
	});

	it('restricts the metadata block to `schemaVersion`', () => {
		expect(validatedPropertiesOf(UpdateDocumentContentMetadataDTO)).toEqual(['schemaVersion']);
	});
});

describe('Query DTOs carry an organization scope', () => {
	it('exposes organizationId on the document-links query', () => {
		expect(validatedPropertiesOf(GetDocumentLinksQueryDTO)).toEqual(
			expect.arrayContaining(['organizationId', 'entity', 'entityId'])
		);
	});

	it('exposes organizationId on the settings query', () => {
		expect(validatedPropertiesOf(DocumentSettingsQueryDTO)).toContain('organizationId');
	});
});
