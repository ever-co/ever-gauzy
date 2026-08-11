import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	FileStorageProviderEnum
} from '@gauzy/contracts';
import { mapOrganizationDocument } from './organization-document.mapper';

describe('mapOrganizationDocument (09 §6.2 + §7 cases 2/3)', () => {
	it('reuses the legacy asset storage key and provider without copying bytes', () => {
		const { fields, warnings } = mapOrganizationDocument({
			id: 'legacy-1',
			name: 'Employee Handbook',
			documentId: 'asset-1',
			document: {
				url: 'organizations/acme/handbook.pdf',
				name: 'handbook.pdf',
				thumb: 'organizations/acme/handbook-thumb.png',
				size: 4096,
				storageProvider: FileStorageProviderEnum.S3
			}
		});

		expect(warnings).toEqual([]);
		expect(fields.kind).toBe(DocumentKindEnum.FILE);
		expect(fields.source).toBe(DocumentSourceEnum.IMPORT);
		expect(fields.externalSource).toBe('organization-document');
		expect(fields.externalId).toBe('legacy-1');
		expect(fields.status).toBe(DocumentStatusEnum.READY);
		expect(fields.knowledgeStatus).toBe(DocumentKnowledgeStatusEnum.NONE);
		expect(fields.reviewStatus).toBe(DocumentReviewStatusEnum.NONE);
		expect(fields.visibility).toBe(DocumentVisibilityEnum.ORGANIZATION);
		expect(fields.storageProvider).toBe(FileStorageProviderEnum.S3);
		expect(fields.storageKey).toBe('organizations/acme/handbook.pdf');
		expect(fields.fileSize).toBe(4096);
		expect(fields.originalFilename).toBe('handbook.pdf');
		expect(fields.mimeType).toBe('application/pdf');
		expect(fields.sha256).toBeNull();
		expect(fields.metadata.legacy.thumbKey).toBe('organizations/acme/handbook-thumb.png');
	});

	it('flags a missing file asset FAILED and routes it to the review queue (§7 case 2)', () => {
		const { fields, warnings } = mapOrganizationDocument({
			id: 'legacy-2',
			name: 'Broken doc',
			documentId: 'asset-gone',
			document: null
		});

		expect(warnings).toEqual(['missing-file-asset']);
		expect(fields.status).toBe(DocumentStatusEnum.FAILED);
		expect(fields.statusMessage).toBe('Legacy file asset missing');
		expect(fields.reviewStatus).toBe(DocumentReviewStatusEnum.PENDING);
		expect(fields.reviewReason).toBe(DocumentReviewReasonEnum.MANUAL);
		expect(fields.storageKey).toBeUndefined();
	});

	it('treats an asset row with an empty storage key as a missing asset (§7 case 2)', () => {
		const { fields, warnings } = mapOrganizationDocument({
			id: 'legacy-3',
			name: 'Empty key',
			documentId: 'asset-3',
			document: { url: '', name: 'x.pdf', size: 0, storageProvider: FileStorageProviderEnum.LOCAL }
		});

		expect(warnings).toEqual(['missing-file-asset']);
		expect(fields.status).toBe(DocumentStatusEnum.FAILED);
	});

	it('imports an external URL-only row as a review-flagged URL reference (§7 case 3)', () => {
		const { fields, warnings } = mapOrganizationDocument({
			id: 'legacy-4',
			name: 'Paid Days off Request',
			documentUrl: 'https://cdn.example.com/policies/paid-days-off.pdf'
		});

		expect(warnings).toEqual(['external-url-reference']);
		expect(fields.status).toBe(DocumentStatusEnum.READY);
		expect(fields.reviewStatus).toBe(DocumentReviewStatusEnum.PENDING);
		expect(fields.reviewReason).toBe(DocumentReviewReasonEnum.MANUAL);
		expect(fields.metadata.externalUrl).toBe('https://cdn.example.com/policies/paid-days-off.pdf');
		expect(fields.storageKey).toBeUndefined();
		expect(fields.storageProvider).toBeUndefined();
		expect(fields.mimeType).toBe('application/pdf');
	});

	it('records the legacy updatedAt for audit and never invents tags', () => {
		const updatedAt = new Date('2024-03-04T05:06:07.000Z');
		const { fields } = mapOrganizationDocument({
			id: 'legacy-5',
			name: 'Anything',
			documentUrl: 'https://cdn.example.com/x.pdf',
			updatedAt
		});

		expect(fields.metadata.legacy.updatedAt).toBe(updatedAt);
		expect(fields.tags).toBeUndefined();
	});
});
