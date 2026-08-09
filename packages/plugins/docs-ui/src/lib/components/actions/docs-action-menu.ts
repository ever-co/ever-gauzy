import { NbMenuItem } from '@nebular/theme';
import { DocumentKindEnum, DocumentKnowledgeStatusEnum, ID, IDocument } from '@gauzy/contracts';

/**
 * Every action a document row can offer, in the tree context menu (`01-ux-spec.md`
 * §3.5) and the table/cards kebab (§4.1 column 9 / §4.2).
 *
 * 🛑 The three surfaces render the SAME list from {@link buildDocsActionMenu} —
 * writing the item set per surface is how the table ended up with no actions at
 * all while the tree offered six of the fourteen the spec asks for.
 */
export type DocsActionId =
	| 'open'
	| 'details'
	| 'preview'
	| 'new-page'
	| 'new-folder'
	| 'upload-here'
	| 'rename'
	| 'move'
	| 'duplicate'
	| 'duplicate-deep'
	| 'favorite'
	| 'copy-link'
	| 'download'
	| 'export-markdown'
	| 'knowledge-import'
	| 'knowledge-exclude'
	| 'archive'
	| 'restore'
	| 'delete';

/**
 * The row/node the menu is built for. Deliberately structural rather than
 * `IDocument`: the tree carries `IDocsTreeNode`, the table/cards carry the list
 * projection, and both satisfy this shape.
 */
export interface IDocsActionTarget {
	id: ID;
	kind: DocumentKindEnum;
	name?: string;
	parentId?: ID | null;
	isArchived?: boolean;
	knowledgeStatus?: DocumentKnowledgeStatusEnum;
	/** Backend list projection (virtual column) — drives the delete subtree prompt. */
	childrenCount?: number;
}

/** Resolved permission flags (the caller reads them once from `NgxPermissionsService`/`Store`). */
export interface IDocsActionPermissions {
	create: boolean;
	update: boolean;
	delete: boolean;
	aiImport: boolean;
}

export interface IDocsActionMenuContext {
	permissions: IDocsActionPermissions;
	/** `getTranslation` of the calling component — labels re-translate on language change. */
	translate: (key: string) => string;
	/**
	 * `'tree'` opens a node in place, so it offers a single "Open".
	 * `'row'` is a content view: it adds "Details" (the side panel) and, for a
	 * FILE, "Preview" — `01-ux-spec.md` §4.1 column 9.
	 */
	surface: 'tree' | 'row';
	/** Star state; flips the label between Favorite and Unfavorite. */
	isFavorite?: boolean;
}

/** Documents whose knowledge state means "already in" — the menu then offers Exclude. */
const KNOWLEDGE_INCLUDED_STATUSES: ReadonlySet<DocumentKnowledgeStatusEnum> = new Set([
	DocumentKnowledgeStatusEnum.QUEUED,
	DocumentKnowledgeStatusEnum.INDEXING,
	DocumentKnowledgeStatusEnum.INDEXED
]);

/** FOLDER and PAGE both hold children; FILE nodes are leaves. */
function isContainer(kind: DocumentKindEnum): boolean {
	return kind !== DocumentKindEnum.FILE;
}

/**
 * Builds the permission-filtered action menu for one document.
 *
 * Order follows the spec table top-to-bottom, with the destructive items last.
 * The action id travels on `data.action`; read it back with {@link docsActionOf}
 * rather than matching on the (translated) title.
 */
export function buildDocsActionMenu(target: IDocsActionTarget, context: IDocsActionMenuContext): NbMenuItem[] {
	const { permissions, translate, surface } = context;
	const items: NbMenuItem[] = [];
	const push = (action: DocsActionId, key: string) => items.push({ title: translate(key), data: { action } });

	const container = isContainer(target.kind);
	const archived = !!target.isArchived;

	// ─── Open ────────────────────────────────────────────────────
	push('open', 'DOCS.TREE.OPEN');
	if (surface === 'row') {
		push('details', 'DOCS.PREVIEW.OPEN_DETAILS');
		if (target.kind === DocumentKindEnum.FILE) push('preview', 'DOCS.PREVIEW.TITLE');
	}

	// ─── Create inside ───────────────────────────────────────────
	// Only containers can take children, and an archived node is out of the
	// working set — creating into it would produce an invisible document.
	if (permissions.create && container && !archived) {
		push('new-page', 'DOCS.TREE.NEW_PAGE');
		push('new-folder', 'DOCS.TREE.NEW_FOLDER');
		push('upload-here', 'DOCS.TREE.UPLOAD_HERE');
	}

	// ─── Edit / relocate ─────────────────────────────────────────
	if (permissions.update && !archived) {
		push('rename', 'DOCS.TREE.RENAME');
		push('move', 'DOCS.TREE.MOVE');
	}

	// Duplicating WRITES a new node: `POST /documents/:id/duplicate` is
	// `@Permissions(DOCS_CREATE)` (document-tree.controller.ts), so gating it on
	// DOCS_UPDATE offers the action to users the backend answers with a 403.
	if (permissions.create && !archived) {
		push('duplicate', 'DOCS.TREE.DUPLICATE');
		// The deep copy is the `{ deep: true }` body the endpoint has always
		// accepted and no UI ever sent (`01-ux-spec.md` §3.5, "with children option").
		if (container) push('duplicate-deep', 'DOCS.TREE.DUPLICATE_WITH_CHILDREN');
	}

	// ─── Read-only affordances (DOCS_READ, which every viewer holds) ──
	items.push({
		title: translate(context.isFavorite ? 'BUTTONS.REMOVE_FROM_FAVORITES' : 'BUTTONS.ADD_TO_FAVORITES'),
		data: { action: 'favorite' as DocsActionId }
	});
	push('copy-link', 'DOCS.TREE.COPY_LINK');
	if (target.kind === DocumentKindEnum.FILE) push('download', 'DOCS.PREVIEW.DOWNLOAD');
	if (target.kind === DocumentKindEnum.PAGE) push('export-markdown', 'DOCS.EXPORT.MARKDOWN');

	// ─── AI knowledge (FOLDER has no body to index) ──────────────
	if (permissions.aiImport && target.kind !== DocumentKindEnum.FOLDER) {
		if (KNOWLEDGE_INCLUDED_STATUSES.has(target.knowledgeStatus as DocumentKnowledgeStatusEnum)) {
			push('knowledge-exclude', 'DOCS.BULK.KNOWLEDGE_EXCLUDE');
		} else {
			push('knowledge-import', 'DOCS.BULK.KNOWLEDGE_IMPORT');
		}
	}

	// ─── Destructive, last ───────────────────────────────────────
	if (permissions.update) {
		push(archived ? 'restore' : 'archive', archived ? 'DOCS.TREE.RESTORE' : 'DOCS.TREE.ARCHIVE');
	}
	// Archive-first rule: `DELETE /documents/:id` answers 409
	// `DOCS_DELETE_REQUIRES_ARCHIVE` for anything still live, so the item is
	// offered only where it can succeed.
	if (permissions.delete && archived) {
		push('delete', 'DOCS.TREE.DELETE');
	}

	return items;
}

/**
 * Narrows a list row to what the menu (and the executor) reads.
 *
 * `isArchived` and `childrenCount` are on the list projection but not on
 * `IDocument`, so they are read through an explicit widening rather than being
 * silently dropped — `childrenCount` is what decides whether the delete prompt
 * offers the subtree choice at all.
 */
export function toDocsActionTarget(row: IDocument): IDocsActionTarget {
	const projection = row as IDocument & { isArchived?: boolean; childrenCount?: number };
	return {
		id: row.id as ID,
		kind: row.kind,
		name: row.name,
		parentId: row.parentId ?? null,
		isArchived: projection.isArchived,
		knowledgeStatus: row.knowledgeStatus,
		childrenCount: projection.childrenCount
	};
}

/** Reads the action id back off a clicked `NbMenuItem`. */
export function docsActionOf(item: NbMenuItem | undefined): DocsActionId | undefined {
	return (item as (NbMenuItem & { data?: { action?: DocsActionId } }) | undefined)?.data?.action;
}

/**
 * Cheap identity of everything the menu is derived from.
 *
 * `[nbContextMenu]` rebuilds its overlay whenever the bound array is a new
 * reference, so a builder called straight from a template binding would rebuild
 * it on every change-detection pass. Callers memoize on this signature.
 */
export function docsActionMenuSignature(target: IDocsActionTarget, context: IDocsActionMenuContext): string {
	const { permissions } = context;
	return [
		String(target.id),
		target.kind,
		target.isArchived ? '1' : '0',
		target.knowledgeStatus ?? '',
		context.isFavorite ? '1' : '0',
		context.surface,
		permissions.create ? '1' : '0',
		permissions.update ? '1' : '0',
		permissions.delete ? '1' : '0',
		permissions.aiImport ? '1' : '0'
	].join('|');
}
