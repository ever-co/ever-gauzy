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
 * How one legacy row resolves against its `ImageAsset` / URL columns. The four values are
 * kept distinct even though two of them share an outcome, because the report semantics
 * differ: `missing-asset-row` means "there was an asset and we lost it", `no-asset-at-all`
 * means "the legacy row never carried a file".
 */
type LegacyAssetCase = 'usable-asset' | 'missing-asset-row' | 'external-url' | 'no-asset-at-all';

/**
 * Classifies a legacy row into its §6.2 / §7 asset case. The order of the checks is the
 * contract — an asset row always outranks a `documentUrl` on the same record.
 *
 * @param legacy The legacy row.
 * @param asset The eager `ImageAsset` of the row (or null).
 * @returns The asset case driving the mapping.
 */
function resolveAssetCase(legacy: ILegacyOrgDocumentInput, asset: ILegacyOrgDocumentInput['document']): LegacyAssetCase {
	if (asset && asset.url) {
		return 'usable-asset';
	}
	if (legacy.documentId || (asset && !asset.url)) {
		return 'missing-asset-row';
	}
	if (legacy.documentUrl) {
		return 'external-url';
	}
	return 'no-asset-at-all';
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

	switch (resolveAssetCase(legacy, asset)) {
		case 'usable-asset':
			// §6.2 — same provider, same key, no byte copy.
			fields.storageProvider = asset.storageProvider ?? null;
			fields.storageKey = asset.url;
			fields.fileSize = asset.size ?? null;
			fields.originalFilename = asset.name ?? null;
			fields.mimeType = inferMimeTypeFromKey(asset.url) ?? inferMimeTypeFromKey(asset.name);
			if (asset.thumb) {
				legacyMetadata.thumbKey = asset.thumb;
			}
			break;

		case 'external-url':
			// §7 case 3 — external URL reference: bytes are not under our control, review-flagged.
			fields.metadata.externalUrl = legacy.documentUrl;
			fields.mimeType = inferMimeTypeFromKey(legacy.documentUrl);
			fields.reviewStatus = DocumentReviewStatusEnum.PENDING;
			fields.reviewReason = DocumentReviewReasonEnum.MANUAL;
			warnings.push('external-url-reference');
			break;

		// §7 case 2 — asset row missing or empty storage key: import anyway, flagged for review.
		case 'missing-asset-row':
		// No asset and no URL at all — treated as the missing-asset case.
		case 'no-asset-at-all':
		default:
			fields.status = DocumentStatusEnum.FAILED;
			fields.statusMessage = 'Legacy file asset missing';
			fields.reviewStatus = DocumentReviewStatusEnum.PENDING;
			fields.reviewReason = DocumentReviewReasonEnum.MANUAL;
			warnings.push('missing-file-asset');
			break;
	}

	return { fields, warnings };
}
