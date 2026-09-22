import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { BaseEntityEnum, IComment, ICommentCreateInput, ICommentUpdateInput, ID, PermissionsEnum } from '@gauzy/contracts';
import { EmployeesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { CommentComposerComponent, ICommentDraft } from './comment-composer.component';
import {
	buildCommentThread,
	commentBlockId,
	commentBody,
	employeeMentionLabel,
	ICommentThreadNode,
	IMentionCandidate,
	withBlockAnchor
} from './document-comments.model';
import { DocumentCommentsService } from './document-comments.service';
import { MentionDirectoryService } from './mention-directory.service';

/**
 * Document comment thread — the detail panel's Comments section.
 *
 * Documents adds no comment API of its own: this binds the platform's generic
 * `/api/comment` to `(BaseEntityEnum.Document, documentId)` (spec 08 §1), which
 * is where threading (`parentId`), resolve, `editedAt` and the mention
 * notification fan-out already live. There is no shared comment-thread component
 * in `ui-core` to reuse — `packages/ui-core` has no comment UI or service at all
 * (searched for comment/mention/thread), so the thread is built here.
 *
 * Permission model, read off the backend rather than assumed:
 *
 * - **Reading** follows document read access. `CommentController` is guarded by
 *   `TenantPermissionGuard`/`PermissionGuard` but declares no `@Permissions()`,
 *   so the API itself only requires tenant membership; the meaningful gate is
 *   that the panel renders only for a document the user can read (`DOCS_READ`).
 * - **Posting** needs no `DOCS_*` permission either — but `CommentService.create()`
 *   resolves the author from `RequestContext.currentEmployeeId()` and throws
 *   `NotFoundException` when that employee does not exist. A user without an
 *   employee record therefore *cannot* comment, so the composer is gated on
 *   having one and says why instead of failing on submit.
 * - **Editing and resolving** are 🛑 author-only: `CommentService.update()` matches
 *   `{ id, employeeId: currentEmployee }`, so a non-author's resolve is a 400,
 *   not a moderation action. The controls follow authorship, not a permission.
 * - **Deleting** goes through the tenant-scoped CRUD delete with no author check,
 *   so it is offered to the author and to `DOCS_MANAGE` holders (moderation).
 */
@Component({
	selector: 'gz-docs-detail-comments',
	templateUrl: './document-comments.component.html',
	styleUrls: ['./document-comments.component.scss'],
	// `EmployeesService` is not root-provided in `ui-core/core`; Documents components
	// bring their own instance (same as `share-dialog.component.ts`). Providing the
	// directory here — not on the composer — means the root box, every reply box and
	// every inline editor under this thread share ONE employee fetch.
	providers: [DocumentCommentsService, MentionDirectoryService, EmployeesService],
	standalone: false
})
export class DocumentCommentsComponent extends TranslationBaseComponent implements OnChanges {
	@Input() documentId: ID;
	/** Document name — carried as `entityName` so the mention notification names the doc. */
	@Input() documentName?: string;

	@ViewChild('rootComposer') private rootComposer?: CommentComposerComponent;

	public nodes: ICommentThreadNode[] = [];
	public total = 0;
	public loading = false;
	public loadError = false;
	/** Set of comment ids with a request in flight — one busy row never freezes the thread. */
	public busyIds = new Set<string>();
	public posting = false;

	public replyingTo: string | null = null;
	public editingId: string | null = null;
	/** Mentions re-derived from the body being edited, so an edit does not un-mention anyone. */
	public editingPicked: IMentionCandidate[] = [];

	public readonly permissions = PermissionsEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly commentsService: DocumentCommentsService,
		private readonly directory: MentionDirectoryService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['documentId'] && this.documentId) {
			this.replyingTo = null;
			this.editingId = null;
			void this.reload();
		}
	}

	// ─── Loading ─────────────────────────────────────────────────

	async reload(): Promise<void> {
		if (!this.documentId) return;
		this.loading = true;
		this.loadError = false;
		try {
			const page = await firstValueFrom(this.commentsService.getAll(this.documentId));
			const items = page?.items ?? [];
			this.nodes = buildCommentThread(items);
			this.total = items.length;
		} catch {
			this.loadError = true;
			this.nodes = [];
			this.total = 0;
		} finally {
			this.loading = false;
		}
	}

	// ─── Permission gates ────────────────────────────────────────

	get canRead(): boolean {
		return this.store.hasPermission(PermissionsEnum.DOCS_READ);
	}

	/** The author id the API will stamp on anything posted from here. */
	get currentEmployeeId(): string | null {
		const user = this.store.user;
		const employeeId = user?.employee?.id ?? user?.employeeId;
		return employeeId ? String(employeeId) : null;
	}

	/** Posting needs a readable document AND an employee record — see the class doc. */
	get canComment(): boolean {
		return this.canRead && !!this.currentEmployeeId;
	}

	/** True when the user may read but has no employee record to post as. */
	get commentingUnavailable(): boolean {
		return this.canRead && !this.currentEmployeeId;
	}

	isOwn(comment: IComment): boolean {
		const authorId = comment?.employeeId ?? comment?.employee?.id;
		return !!authorId && String(authorId) === this.currentEmployeeId;
	}

	/** Author-only: `CommentService.update()` filters by the current employee. */
	canEdit(comment: IComment): boolean {
		return this.canComment && this.isOwn(comment);
	}

	/** Resolve is an update, so it inherits the author-only rule above. */
	canResolve(comment: IComment): boolean {
		return this.canEdit(comment);
	}

	canDelete(comment: IComment): boolean {
		return this.canComment && (this.isOwn(comment) || this.store.hasPermission(PermissionsEnum.DOCS_MANAGE));
	}

	isBusy(comment: IComment): boolean {
		return this.busyIds.has(String(comment?.id));
	}

	// ─── Posting ─────────────────────────────────────────────────

	async post(draft: ICommentDraft): Promise<void> {
		if (!this.canComment || this.posting) return;
		this.posting = true;
		try {
			const comment = await firstValueFrom(this.commentsService.create(this.createInput(draft)));
			this.insert(comment);
			this.rootComposer?.reset();
			this.toastrService.success(this.getTranslation('DOCS.COMMENTS.TOAST_POSTED'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.posting = false;
		}
	}

	startReply(comment: IComment): void {
		this.replyingTo = String(comment.id);
		this.editingId = null;
	}

	cancelReply(): void {
		this.replyingTo = null;
	}

	isReplying(comment: IComment): boolean {
		return this.replyingTo === String(comment.id);
	}

	async reply(parent: IComment, draft: ICommentDraft): Promise<void> {
		if (!this.canComment || this.isBusy(parent)) return;
		this.markBusy(parent, true);
		try {
			const comment = await firstValueFrom(
				this.commentsService.create({ ...this.createInput(draft), parentId: parent.id as ID })
			);
			this.insert(comment);
			this.replyingTo = null;
			this.toastrService.success(this.getTranslation('DOCS.COMMENTS.TOAST_POSTED'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.markBusy(parent, false);
		}
	}

	// ─── Editing ─────────────────────────────────────────────────

	async startEdit(comment: IComment): Promise<void> {
		this.editingId = String(comment.id);
		this.replyingTo = null;
		// Seed the picks from the saved body — an edit re-sends the whole array. The block
		// anchor is stripped first: it is machinery, never part of the text being matched.
		this.editingPicked = await firstValueFrom(this.directory.matchInText(this.body(comment))).catch(() => []);
	}

	cancelEdit(): void {
		this.editingId = null;
		this.editingPicked = [];
	}

	isEditing(comment: IComment): boolean {
		return this.editingId === String(comment.id);
	}

	async saveEdit(comment: IComment, draft: ICommentDraft): Promise<void> {
		if (!this.canEdit(comment) || this.isBusy(comment)) return;
		this.markBusy(comment, true);
		try {
			const updated = await firstValueFrom(
				this.commentsService.update(comment.id as ID, {
					// Re-stamp the anchor the composer never saw — an edit that dropped it
					// would silently detach the comment from its block.
					comment: withBlockAnchor(commentBlockId(comment), draft.comment),
					mentionEmployeeIds: draft.mentionEmployeeIds,
					editedAt: new Date()
				})
			);
			this.replace(comment, updated);
			this.cancelEdit();
			this.toastrService.success(this.getTranslation('DOCS.COMMENTS.TOAST_UPDATED'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.markBusy(comment, false);
		}
	}

	// ─── Resolve / delete ────────────────────────────────────────

	async toggleResolved(comment: IComment): Promise<void> {
		if (!this.canResolve(comment) || this.isBusy(comment)) return;
		const resolved = !comment.resolved;
		this.markBusy(comment, true);
		try {
			const updated = await firstValueFrom(
				this.commentsService.update(comment.id as ID, {
					resolved,
					// The column is not derived server-side — an unresolve that left a
					// stale `resolvedAt` would read as "resolved" in every export.
					// `null` is the explicit clear; `resolvedAt` is typed `Date`, and
					// omitting it would leave the old timestamp in place.
					resolvedAt: resolved ? new Date() : (null as unknown as Date)
				} as ICommentUpdateInput)
			);
			this.replace(comment, { ...updated, resolved });
			this.toastrService.success(
				this.getTranslation(resolved ? 'DOCS.COMMENTS.TOAST_RESOLVED' : 'DOCS.COMMENTS.TOAST_REOPENED')
			);
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.markBusy(comment, false);
		}
	}

	async remove(comment: IComment): Promise<void> {
		if (!this.canDelete(comment) || this.isBusy(comment)) return;
		this.markBusy(comment, true);
		try {
			await firstValueFrom(this.commentsService.delete(comment.id as ID));
			this.drop(comment);
			this.toastrService.success(this.getTranslation('DOCS.COMMENTS.TOAST_DELETED'));
		} catch (error) {
			this.markBusy(comment, false);
			this.toastrService.danger(error);
		}
	}

	// ─── Presentation ────────────────────────────────────────────

	authorLabel(comment: IComment): string {
		return employeeMentionLabel(comment?.employee) || this.getTranslation('DOCS.COMMENTS.UNKNOWN_AUTHOR');
	}

	/**
	 * The readable body. Comments posted from the editor's block threads carry a
	 * `[[block:…]]` marker as their first line (see `document-comments.model.ts`); this panel
	 * shows the whole document's thread, so it must strip it rather than print machinery.
	 */
	body(comment: IComment): string {
		return commentBody(comment);
	}

	/** True when the comment is anchored to an editor block rather than the document. */
	isBlockAnchored(comment: IComment): boolean {
		return !!commentBlockId(comment);
	}

	trackNode(_: number, node: ICommentThreadNode): string {
		return String(node.comment.id);
	}

	trackComment(_: number, comment: IComment): string {
		return String(comment.id);
	}

	// ─── Local thread mutation ───────────────────────────────────

	/**
	 * Re-threads the whole page after a change instead of splicing in place: the
	 * grouping rules (orphan promotion, ordering) live in one function, and a
	 * reply inserted by hand is exactly where they would drift apart.
	 */
	private rebuild(comments: IComment[]): void {
		this.nodes = buildCommentThread(comments);
		this.total = comments.length;
	}

	private flatten(): IComment[] {
		return this.nodes.flatMap((node) => [node.comment, ...node.replies]);
	}

	private insert(comment: IComment): void {
		this.rebuild([...this.flatten(), comment]);
	}

	private replace(previous: IComment, updated: IComment): void {
		this.rebuild(
			this.flatten().map((entry) =>
				String(entry.id) === String(previous.id) ? { ...entry, ...updated, id: previous.id } : entry
			)
		);
	}

	private drop(comment: IComment): void {
		this.busyIds.delete(String(comment.id));
		this.rebuild(this.flatten().filter((entry) => String(entry.id) !== String(comment.id)));
	}

	private markBusy(comment: IComment, busy: boolean): void {
		const id = String(comment?.id);
		// A new Set keeps the template's `isBusy()` honest under OnPush parents.
		const next = new Set(this.busyIds);
		if (busy) next.add(id);
		else next.delete(id);
		this.busyIds = next;
	}

	private createInput(draft: ICommentDraft): ICommentCreateInput {
		return {
			entity: BaseEntityEnum.Document,
			entityId: this.documentId,
			entityName: this.documentName,
			comment: draft.comment,
			mentionEmployeeIds: draft.mentionEmployeeIds
		};
	}
}
