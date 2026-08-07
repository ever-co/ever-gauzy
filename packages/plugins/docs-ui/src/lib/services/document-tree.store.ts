import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { DocumentsService } from './documents.service';

/** Lightweight tree node derived from IDocument (shared by tree, move dialog, breadcrumbs). */
export interface IDocsTreeNode {
	id: ID;
	name: string;
	kind: DocumentKindEnum;
	parentId?: ID | null;
	icon?: string;
	color?: string;
	isLocked?: boolean;
	visibility?: string;
	hasChildren: boolean;
	children?: IDocsTreeNode[];
}

/**
 * BehaviorSubject-based node cache for the Documents tree. Kept outside elf
 * deliberately — nodes are shared by the tree, the move dialog and breadcrumbs.
 * Invalidated by move/create/archive mutation events from the browse page.
 */
@Injectable()
export class DocumentTreeStore {
	/** parentId (or '' for root) → children (undefined = not loaded yet). */
	private readonly _children = new Map<string, IDocsTreeNode[]>();
	/** id → node (flat index across everything loaded so far). */
	private readonly _byId = new Map<string, IDocsTreeNode>();

	private readonly _nodes$ = new BehaviorSubject<IDocsTreeNode[]>([]);
	/** Root-level nodes (reference refreshed on every cache change). */
	public readonly nodes$: Observable<IDocsTreeNode[]> = this._nodes$.asObservable();

	constructor(private readonly documentsService: DocumentsService) {}

	// ─── Loading ─────────────────────────────────────────────────

	/** Lazily loads (and memoizes) the children of a node; `null` = root level. */
	async loadChildren(parentId: ID | null): Promise<IDocsTreeNode[]> {
		const key = this.keyOf(parentId);
		const cached = this._children.get(key);
		if (cached) return cached;

		const { items } = await firstValueFrom(
			this.documentsService.getAll({ parentId: parentId ?? null, archived: false, sort: 'index:asc' })
		);
		const nodes = (items ?? []).map((doc) => this.toNode(doc));
		this._children.set(key, nodes);
		nodes.forEach((node) => this._byId.set(String(node.id), node));
		this.emit();
		return nodes;
	}

	async loadRoots(): Promise<IDocsTreeNode[]> {
		return this.loadChildren(null);
	}

	// ─── Queries ─────────────────────────────────────────────────

	getNode(id: ID | null | undefined): IDocsTreeNode | undefined {
		return id ? this._byId.get(String(id)) : undefined;
	}

	/**
	 * Cycle guard for `allowDrop`: true when `nodeId` is an ancestor of
	 * `ancestorCandidateId` — i.e. dropping into it would create a cycle.
	 * Walks only loaded nodes; unloaded ancestry resolves to false (the server
	 * re-validates and the optimistic move reverts on error).
	 */
	isDescendantOf(candidateId: ID | null | undefined, nodeId: ID): boolean {
		let current = this.getNode(candidateId);
		const target = String(nodeId);
		const seen = new Set<string>();
		while (current) {
			const id = String(current.id);
			if (id === target) return true;
			if (seen.has(id)) return false; // defensive: malformed cycles
			seen.add(id);
			current = this.getNode(current.parentId ?? undefined);
		}
		return false;
	}

	/** Breadcrumb chain root → node (loaded nodes only). */
	pathOf(id: ID): IDocsTreeNode[] {
		const path: IDocsTreeNode[] = [];
		let current = this.getNode(id);
		while (current) {
			path.unshift(current);
			current = this.getNode(current.parentId ?? undefined);
		}
		return path;
	}

	// ─── Mutation events ─────────────────────────────────────────

	/** Drops the cached children of a parent (and the root list when null). */
	invalidate(parentId?: ID | null): void {
		this._children.delete(this.keyOf(parentId ?? null));
		this.emit();
	}

	/** Full cache reset (org switch, bulk mutations). */
	invalidateAll(): void {
		this._children.clear();
		this._byId.clear();
		this.emit();
	}

	/** Optimistic local re-parent; call `invalidate` on API error to revert. */
	applyMove(nodeId: ID, newParentId: ID | null): void {
		const node = this.getNode(nodeId);
		if (!node) return;
		const oldKey = this.keyOf(node.parentId ?? null);
		const newKey = this.keyOf(newParentId);
		const oldSiblings = this._children.get(oldKey);
		if (oldSiblings) {
			this._children.set(
				oldKey,
				oldSiblings.filter((n) => String(n.id) !== String(nodeId))
			);
		}
		node.parentId = newParentId;
		const newSiblings = this._children.get(newKey);
		if (newSiblings && !newSiblings.some((n) => String(n.id) === String(nodeId))) {
			this._children.set(newKey, [...newSiblings, node]);
		}
		this.emit();
	}

	// ─── Internals ───────────────────────────────────────────────

	private toNode(doc: IDocument): IDocsTreeNode {
		return {
			id: doc.id as ID,
			name: doc.name,
			kind: doc.kind,
			parentId: doc.parentId ?? null,
			icon: doc.icon,
			color: doc.color,
			isLocked: doc.isLocked,
			visibility: doc.visibility,
			// FILE nodes are leaves; FOLDER/PAGE may have lazily loaded children.
			hasChildren: doc.kind !== DocumentKindEnum.FILE
		};
	}

	private keyOf(parentId: ID | null | undefined): string {
		return parentId ? String(parentId) : '';
	}

	private emit(): void {
		this._nodes$.next(this._children.get('') ?? []);
	}
}
