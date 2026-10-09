import { NbIconConfig, NbMenuItem } from '@nebular/theme';
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
	/**
	 * Row-level ownership scope from `DocumentPermissionService.canMutate()`
	 * (`08-permissions-security.md` §1.7/§1.8) — `DOCS_MANAGE` holder or the document's own
	 * creator.
	 *
	 * 🛑 Independent of `permissions.update`, exactly as on the server: the write rule is
	 * `DOCS_UPDATE AND (DOCS_MANAGE OR creator OR EDIT share)`, so both halves have to hold.
	 * Left `undefined` (a caller that has not resolved it yet) it defaults to permissive, which
	 * keeps the pre-ownership behaviour rather than silently emptying a menu.
	 */
	canMutate?: boolean;
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
 * `nbContextMenuClass` for every surface that renders this menu — the styles live
 * globally in `docs-shell.component.scss`, because the menu renders in the CDK
 * overlay, outside every docs component.
 */
export const DOCS_ACTION_MENU_CLASS = 'gz-docs-action-menu';

/**
 * A divider between two sections. Nebular renders a `group` item as an inert
 * `li.menu-group` with no click handler, so it never reaches `onItemClick`; it
 * carries no `data.action`, which {@link docsActionOf} reads as "not an action".
 */
function divider(): NbMenuItem {
	return { title: '', group: true };
}

/**
 * Builds the permission-filtered action menu for one document.
 *
 * Order follows the spec table top-to-bottom, in sections (open · create ·
 * organize · share · AI · destructive) separated by dividers, with the
 * destructive items last. Every item carries an icon; Delete is `danger`.
 * The action id travels on `data.action`; read it back with {@link docsActionOf}
 * rather than matching on the (translated) title.
 */
export function buildDocsActionMenu(target: IDocsActionTarget, context: IDocsActionMenuContext): NbMenuItem[] {
	const { permissions, translate, surface } = context;
	const sections: NbMenuItem[][] = [];
	const section = (): NbMenuItem[] => {
		const items: NbMenuItem[] = [];
		sections.push(items);
		return items;
	};
	const item = (action: DocsActionId, key: string, icon: string | NbIconConfig, shortcut?: string): NbMenuItem => ({
		title: translate(key),
		icon,
		data: { action },
		// Tree-only: these keys are bound on the focused tree node, nowhere else.
		...(shortcut && surface === 'tree' ? { badge: { text: shortcut, status: 'basic' } } : {})
	});

	const container = isContainer(target.kind);
	const archived = !!target.isArchived;
	// Ownership half of the write rule (§1.7). Absent = permissive, so a caller that never
	// resolved it keeps the previous item set.
	const mutable = context.canMutate !== false;

	// ─── Open ───────────────────────────────────────────────────────
	const open = section();
	if (surface === 'row') {
		// A content view opens a FILE in the preview modal, so "Open" and "Preview" were the
		// same item twice. Folders and pages get a label that says where they go.
		if (target.kind === DocumentKindEnum.FILE) {
			open.push(item('preview', 'DOCS.PREVIEW.TITLE', 'eye-outline'));
		} else if (target.kind === DocumentKindEnum.FOLDER) {
			open.push(item('open', 'DOCS.ACTION_MENU.OPEN_FOLDER', 'folder-outline'));
		} else {
			open.push(item('open', 'DOCS.ACTION_MENU.OPEN_EDITOR', 'external-link-outline'));
		}
		open.push(item('details', 'DOCS.PREVIEW.OPEN_DETAILS', 'info-outline'));
	} else {
		open.push(item('open', 'DOCS.TREE.OPEN', 'external-link-outline'));
	}

	// ─── Create inside ──────────────────────────────────────────────
	// Only containers can take children, and an archived node is out of the
	// working set — creating into it would produce an invisible document.
	const create = section();
	if (permissions.create && container && !archived) {
		create.push(item('new-page', 'DOCS.TREE.NEW_PAGE', 'file-add-outline'));
		create.push(item('new-folder', 'DOCS.TREE.NEW_FOLDER', 'folder-add-outline'));
		create.push(item('upload-here', 'DOCS.TREE.UPLOAD_HERE', 'cloud-upload-outline'));
	}

	// ─── Organize ───────────────────────────────────────────────────
	// `mutable` is the ownership half: `01-ux-spec.md` §3.5 offers these to a DOCS_UPDATE
	// holder, but §1.8 scopes edit and tree ops to **own** documents for everyone below ADMIN.
	const organize = section();
	if (permissions.update && mutable && !archived) {
		organize.push(item('rename', 'DOCS.TREE.RENAME', 'edit-2-outline', 'F2'));
		organize.push(item('move', 'DOCS.TREE.MOVE', 'move-outline'));
	}

	// Duplicating WRITES a new node: `POST /documents/:id/duplicate` is
	// `@Permissions(DOCS_CREATE)` (document-tree.controller.ts), so gating it on
	// DOCS_UPDATE offers the action to users the backend answers with a 403.
	if (permissions.create && !archived) {
		organize.push(item('duplicate', 'DOCS.TREE.DUPLICATE', 'copy-outline'));
		// The deep copy is the `{ deep: true }` body the endpoint has always accepted
		// (`01-ux-spec.md` §3.5, "with children option"). A container the list projection
		// reports as EMPTY has no subtree, so it would be the same copy under a longer name;
		// `undefined` (the tree carries no count) keeps the item.
		if (container && target.childrenCount !== 0) {
			organize.push(item('duplicate-deep', 'DOCS.TREE.DUPLICATE_WITH_CHILDREN', 'layers-outline'));
		}
	}

	// ─── Share / export (DOCS_READ, which every viewer holds) ───────
	const share = section();
	share.push(
		item(
			'favorite',
			context.isFavorite ? 'BUTTONS.REMOVE_FROM_FAVORITES' : 'BUTTONS.ADD_TO_FAVORITES',
			context.isFavorite ? { icon: 'star', status: 'warning' } : 'star-outline'
		)
	);
	share.push(item('copy-link', 'DOCS.TREE.COPY_LINK', 'link-2-outline'));
	if (target.kind === DocumentKindEnum.FILE) share.push(item('download', 'DOCS.PREVIEW.DOWNLOAD', 'download-outline'));
	if (target.kind === DocumentKindEnum.PAGE) {
		share.push(item('export-markdown', 'DOCS.EXPORT.MARKDOWN', 'file-text-outline'));
	}

	// ─── AI knowledge (FOLDER has no body to index) ─────────────────
	const knowledge = section();
	if (permissions.aiImport && target.kind !== DocumentKindEnum.FOLDER) {
		if (KNOWLEDGE_INCLUDED_STATUSES.has(target.knowledgeStatus as DocumentKnowledgeStatusEnum)) {
			knowledge.push(item('knowledge-exclude', 'DOCS.BULK.KNOWLEDGE_EXCLUDE', 'slash-outline'));
		} else {
			knowledge.push(item('knowledge-import', 'DOCS.BULK.KNOWLEDGE_IMPORT', 'bulb-outline'));
		}
	}

	// ─── Destructive, last ──────────────────────────────────────────
	// Archive/unarchive and delete are both **own**-scoped below ADMIN (§1.8), so they carry
	// the ownership half too.
	const destructive = section();
	if (permissions.update && mutable) {
		destructive.push(
			archived
				? item('restore', 'DOCS.TREE.RESTORE', 'undo-outline')
				: item('archive', 'DOCS.TREE.ARCHIVE', 'archive-outline', 'Del')
		);
	}
	// Archive-first rule: `DELETE /documents/:id` answers 409
	// `DOCS_DELETE_REQUIRES_ARCHIVE` for anything still live, so the item is
	// offered only where it can succeed.
	if (permissions.delete && mutable && archived) {
		destructive.push(item('delete', 'DOCS.TREE.DELETE', { icon: 'trash-2-outline', status: 'danger' }));
	}

	// Dividers only BETWEEN non-empty sections — never leading, trailing or doubled.
	return sections
		.filter((items) => items.length > 0)
		.flatMap((items, index) => (index === 0 ? items : [divider(), ...items]));
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
		// An empty container drops "Duplicate with children".
		target.childrenCount === 0 ? '1' : '0',
		target.knowledgeStatus ?? '',
		context.isFavorite ? '1' : '0',
		context.canMutate === false ? '0' : '1',
		context.surface,
		permissions.create ? '1' : '0',
		permissions.update ? '1' : '0',
		permissions.delete ? '1' : '0',
		permissions.aiImport ? '1' : '0'
	].join('|');
}
