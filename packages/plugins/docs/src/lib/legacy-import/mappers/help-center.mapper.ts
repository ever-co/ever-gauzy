import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	JsonData
} from '@gauzy/contracts';
import {
	LEGACY_SOURCE_HELP_CENTER,
	LEGACY_SOURCE_HELP_CENTER_ARTICLE,
	LegacyImportWarning
} from '../legacy-import.types';
import {
	emptyTiptapDoc,
	isEmptyHtml,
	mapArticlePrivacyToVisibility,
	mapDraftToReview,
	mapNodePrivacyToVisibility,
	parseJsonColumn,
	sanitizeLegacyHtml
} from './mapping.utils';

/**
 * The plain legacy shape of a `knowledge_base` row consumed by the node mapper — kept
 * structural so the mapper stays pure and unit-testable without an ORM.
 */
export interface ILegacyHelpCenterNodeInput {
	id: string;
	name: string;
	/** `'base'` | `'category'` — advisory only; placement is positional (§7 cases 5/6). */
	flag?: string | null;
	icon?: string | null;
	/** Eva icon string; `'eye-off-outline'` means private (§6.3). */
	privacy?: string | null;
	language?: string | null;
	color?: string | null;
	description?: string | null;
	data?: string | null;
	index?: number | null;
	parentId?: string | null;
}

/**
 * The plain legacy shape of a `knowledge_base_article` row consumed by the article mapper.
 */
export interface ILegacyHelpCenterArticleInput {
	id: string;
	name: string;
	description?: string | null;
	/** Legacy CKEditor 4 HTML — the only column the legacy Angular UI ever wrote. */
	data?: string | null;
	draft?: boolean | null;
	privacy?: boolean | null;
	index?: number | null;
	descriptionHtml?: string | null;
	descriptionJson?: JsonData | string | null;
	descriptionBinary?: Uint8Array | Buffer | null;
	isLocked?: boolean | null;
	color?: string | null;
	/** The legacy *integration* column — NOT our provenance `externalId` (§6.4). */
	externalId?: string | null;
	categoryId?: string | null;
	/** Article nesting parent (pass B). */
	parentId?: string | null;
	ownedById?: string | null;
	/** Employee ids from the `knowledge_base_author` join (§6.6). */
	authorEmployeeIds?: string[];
}

/**
 * The mapper output: the field bag to merge into the new `Document` row + the report signals.
 */
export interface IHelpCenterMapResult {
	fields: Record<string, any>;
	warnings: LegacyImportWarning[];
}

/**
 * Placement context resolved by the caller before mapping a node.
 */
export interface IHelpCenterNodePlacement {
	/** Whether the legacy `parentId` resolved to an already-mapped Document. */
	parentResolved: boolean;
}

/**
 * Maps one `knowledge_base` node (base or category) to `Document` FOLDER fields per §6.3.
 *
 * Placement is **positional**, never flag-driven: a node whose parent resolved becomes that
 * parent's child regardless of `flag`; a node without a resolvable parent becomes a root
 * folder. The `flag` mismatch cases only produce report warnings (§7 cases 5/6).
 *
 * Name suffixing, base tenant fields, `parentId`, `index`, and the migration metadata
 * envelope are applied by the caller.
 *
 * @param legacy The legacy node row.
 * @param placement Whether the legacy parent resolved to a mapped Document.
 * @returns The mapped `Document` field bag + warnings.
 */
export function mapHelpCenterNode(
	legacy: ILegacyHelpCenterNodeInput,
	placement: IHelpCenterNodePlacement = { parentResolved: false }
): IHelpCenterMapResult {
	const warnings: LegacyImportWarning[] = [];
	const visibility = mapNodePrivacyToVisibility(legacy.privacy);

	if (visibility === DocumentVisibilityEnum.PRIVATE) {
		// §6.6 — legacy privacy was display-only; Documents enforces it. Always surfaced.
		warnings.push('mapped-private');
	}

	const flag = (legacy.flag ?? '').toLowerCase();
	if (flag === 'category' && !placement.parentResolved) {
		// §7 case 5 — orphaned category: imported as a root folder.
		warnings.push('orphaned-category');
	}
	if (flag === 'base' && placement.parentResolved) {
		// §7 case 6 — a base with a parent: positional placement wins.
		warnings.push('mixed-flag-state');
	}

	const legacyMetadata: Record<string, any> = {};
	if (legacy.flag !== null && legacy.flag !== undefined) {
		legacyMetadata.flag = legacy.flag;
	}
	if (legacy.language) {
		legacyMetadata.language = legacy.language;
	}
	if (legacy.data) {
		legacyMetadata.data = legacy.data;
	}
	if (legacy.privacy !== null && legacy.privacy !== undefined) {
		legacyMetadata.privacy = legacy.privacy;
	}

	const fields: Record<string, any> = {
		kind: DocumentKindEnum.FOLDER,
		source: DocumentSourceEnum.IMPORT,
		externalSource: LEGACY_SOURCE_HELP_CENTER,
		externalId: legacy.id,
		status: DocumentStatusEnum.READY,
		knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
		reviewStatus: DocumentReviewStatusEnum.NONE,
		reviewReason: null,
		visibility,
		searchable: true,
		icon: legacy.icon ?? null,
		color: legacy.color ?? null,
		description: legacy.description ?? null,
		index: legacy.index ?? 0,
		version: 1,
		metadata: { legacy: legacyMetadata }
	};

	return { fields, warnings };
}

/**
 * Maps one `knowledge_base_article` row to `Document` PAGE fields per §6.4.
 *
 * Content resolution (deliberate deviation from the spec's server-side HTML→JSON conversion —
 * see the module README note): `descriptionJson` is preferred verbatim when present; otherwise
 * the sanitized legacy HTML is stored in `contentHtml` and `contentJson` is left `null` with an
 * `html-conversion-degraded` warning — the editor converts on first open, so no server-side
 * TipTap runtime is required by the migration. A wholly empty article gets the canonical empty
 * editor document (§7 case 4).
 *
 * @param legacy The legacy article row (with its author employee ids resolved).
 * @returns The mapped `Document` field bag + warnings.
 */
export function mapHelpCenterArticle(legacy: ILegacyHelpCenterArticleInput): IHelpCenterMapResult {
	const warnings: LegacyImportWarning[] = [];
	const visibility = mapArticlePrivacyToVisibility(legacy.privacy);
	const { reviewStatus, reviewReason } = mapDraftToReview(legacy.draft);

	if (visibility === DocumentVisibilityEnum.PRIVATE) {
		warnings.push('mapped-private');
	}

	const legacyMetadata: Record<string, any> = {};
	if (legacy.draft !== null && legacy.draft !== undefined) {
		legacyMetadata.draft = legacy.draft;
	}
	if (legacy.privacy !== null && legacy.privacy !== undefined) {
		legacyMetadata.privacy = legacy.privacy;
	}
	if (legacy.externalId) {
		// The legacy *integration* id — never our provenance key.
		legacyMetadata.externalId = legacy.externalId;
	}
	if (legacy.ownedById) {
		legacyMetadata.ownedById = legacy.ownedById;
	}
	if (legacy.authorEmployeeIds?.length) {
		legacyMetadata.authorEmployeeIds = [...legacy.authorEmployeeIds];
	}
	if (legacy.categoryId) {
		legacyMetadata.categoryId = legacy.categoryId;
	}

	const fields: Record<string, any> = {
		kind: DocumentKindEnum.PAGE,
		source: DocumentSourceEnum.IMPORT,
		externalSource: LEGACY_SOURCE_HELP_CENTER_ARTICLE,
		externalId: legacy.id,
		status: DocumentStatusEnum.READY,
		knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
		reviewStatus,
		reviewReason,
		visibility,
		searchable: true,
		description: legacy.description ?? null,
		index: legacy.index ?? 0,
		isLocked: legacy.isLocked ?? false,
		color: legacy.color ?? null,
		version: 1,
		metadata: { legacy: legacyMetadata }
	};

	const content = resolveArticleContent(legacy);
	fields.contentJson = content.contentJson;
	fields.contentHtml = content.contentHtml;
	warnings.push(...content.warnings);

	return { fields, warnings };
}

/**
 * Content resolution result of a legacy article.
 */
export interface IArticleContentResult {
	contentJson: JsonData | null;
	contentHtml: string | null;
	warnings: LegacyImportWarning[];
}

/**
 * Resolves the `contentJson` / `contentHtml` pair of a legacy article (§6.4 + §7 cases 4/8).
 *
 * Precedence: `descriptionJson` (editor-native) → sanitized `descriptionHtml` → sanitized
 * legacy `data` HTML. When only HTML is available, `contentJson` stays `null` and the record
 * carries `html-conversion-degraded`; the frontend converts on first open. A record with no
 * usable content in any column gets the canonical empty editor document.
 *
 * @param legacy The legacy article row.
 * @returns The resolved content pair + warnings.
 */
export function resolveArticleContent(legacy: ILegacyHelpCenterArticleInput): IArticleContentResult {
	const warnings: LegacyImportWarning[] = [];
	const contentJson = parseJsonColumn(legacy.descriptionJson);
	const rawHtml = legacy.descriptionHtml ?? legacy.data ?? null;
	const contentHtml = isEmptyHtml(rawHtml) ? null : sanitizeLegacyHtml(rawHtml);

	if (contentJson) {
		// Editor-native JSON already exists — the HTML copy is only the fidelity reference.
		return { contentJson, contentHtml, warnings };
	}

	if (contentHtml) {
		// Deferred conversion: the editor generates JSON from `contentHtml` on first open.
		warnings.push('html-conversion-degraded');
		return { contentJson: null, contentHtml, warnings };
	}

	if (legacy.descriptionBinary && (legacy.descriptionBinary as ArrayLike<number>).length) {
		// Only a CRDT payload survives — no JSON/HTML to render; start from an empty document.
		return { contentJson: emptyTiptapDoc(), contentHtml: null, warnings };
	}

	// §7 case 4 — an article with no content at all in any column.
	warnings.push('empty-content');
	return { contentJson: emptyTiptapDoc(), contentHtml: null, warnings };
}
