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
import { LegacyImportWarning, LEGACY_SOURCE_ORG_DOCUMENT } from '../legacy-import.types';
import { inferMimeTypeFromKey } from './mapping.utils';

/**
 * The plain legacy shape the mapper consumes — a subset of `OrganizationDocument` (+ its eager
 * `ImageAsset`). Kept structural so the mapper stays pure and unit-testable.
 */
export interface ILegacyOrgDocumentInput {
	id: string;
	name: string;
	documentUrl?: string | null;
	documentId?: string | null;
	document?: {
		url?: string | null;
		name?: string | null;
		thumb?: string | null;
		size?: number | null;
		storageProvider?: FileStorageProviderEnum | string | null;
	} | null;
	updatedAt?: Date | string | null;
}

/**
 * The mapper output: the field bag to merge into the new `Document` row + the report signals.
 */
export interface IOrgDocumentMapResult {
	fields: Record<string, any>;
	warnings: LegacyImportWarning[];
}

/**
 * Maps one `organization_document` row to `Document` fields per §6.2, including the §7
 * edge cases: asset-backed FILE (storage key/provider reuse — no byte copy), missing asset
 * (`status: FAILED` + review flag), and external-URL reference (review flag).
 *
 * Name suffixing, base tenant fields (`tenantId`/`createdAt`/…), and the migration metadata
 * envelope are applied by the caller.
 *
 * @param legacy The legacy row (with its eager asset when present).
 * @returns The mapped `Document` field bag + warnings.
 */
export function mapOrganizationDocument(legacy: ILegacyOrgDocumentInput): IOrgDocumentMapResult {
	const warnings: LegacyImportWarning[] = [];
	const asset = legacy.document ?? null;
	const hasUsableAsset = Boolean(asset && asset.url);

	const legacyMetadata: Record<string, any> = {};
	if (legacy.updatedAt) {
		legacyMetadata.updatedAt = legacy.updatedAt;
	}

	const fields: Record<string, any> = {
		kind: DocumentKindEnum.FILE,
		source: DocumentSourceEnum.IMPORT,
		externalSource: LEGACY_SOURCE_ORG_DOCUMENT,
		externalId: legacy.id,
		status: DocumentStatusEnum.READY,
		knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
		reviewStatus: DocumentReviewStatusEnum.NONE,
		reviewReason: null,
		visibility: DocumentVisibilityEnum.ORGANIZATION,
		searchable: true,
		version: 1,
		sha256: null,
		metadata: { legacy: legacyMetadata }
	};

	if (hasUsableAsset) {
		// §6.2 — same provider, same key, no byte copy.
		fields.storageProvider = asset.storageProvider ?? null;
		fields.storageKey = asset.url;
		fields.fileSize = asset.size ?? null;
		fields.originalFilename = asset.name ?? null;
		fields.mimeType = inferMimeTypeFromKey(asset.url) ?? inferMimeTypeFromKey(asset.name);
		if (asset.thumb) {
			legacyMetadata.thumbKey = asset.thumb;
		}
	} else if (legacy.documentId || (asset && !asset.url)) {
		// §7 case 2 — asset row missing or empty storage key: import anyway, flagged for review.
		fields.status = DocumentStatusEnum.FAILED;
		fields.statusMessage = 'Legacy file asset missing';
		fields.reviewStatus = DocumentReviewStatusEnum.PENDING;
		fields.reviewReason = DocumentReviewReasonEnum.MANUAL;
		warnings.push('missing-file-asset');
	} else if (legacy.documentUrl) {
		// §7 case 3 — external URL reference: bytes are not under our control, review-flagged.
		fields.metadata.externalUrl = legacy.documentUrl;
		fields.mimeType = inferMimeTypeFromKey(legacy.documentUrl);
		fields.reviewStatus = DocumentReviewStatusEnum.PENDING;
		fields.reviewReason = DocumentReviewReasonEnum.MANUAL;
		warnings.push('external-url-reference');
	} else {
		// No asset and no URL at all — treated as the missing-asset case.
		fields.status = DocumentStatusEnum.FAILED;
		fields.statusMessage = 'Legacy file asset missing';
		fields.reviewStatus = DocumentReviewStatusEnum.PENDING;
		fields.reviewReason = DocumentReviewReasonEnum.MANUAL;
		warnings.push('missing-file-asset');
	}

	return { fields, warnings };
}
