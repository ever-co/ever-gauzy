import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	Injector,
	Input,
	OnChanges,
	Output,
	type SimpleChanges,
	ViewChild,
	afterNextRender,
	inject
} from '@angular/core';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbInputModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
	BaseEntityEnum,
	DocumentCommentAnchorMethodEnum,
	DocumentCommentAnchorStatusEnum,
	IComment,
	ID,
	PermissionsEnum,
	type IDocumentCommentAnchorInput,
	type IDocumentCommentAnchorPosition,
	type IDocumentCommentAnchorResolved
} from '@gauzy/contracts';
import { EmployeesService, Store, ToastrService } from '@gauzy/ui-core/core';
import {
	applyMentionPick,
	buildCommentThread,
	collectMentionEmployeeIds,
	commentBlockId,
	commentBody,
	detectMentionToken,
	employeeMentionLabel,
	groupCommentsByBlock,
	ICommentThreadNode,
	IMentionCandidate,
	IMentionToken,
	openBlockAnchors,
	withBlockAnchor
} from '../../components/comments/document-comments.model';
import { DocumentCommentsService } from '../../components/comments/document-comments.service';
import { MentionDirectoryService } from '../../components/comments/mention-directory.service';
import {
	anchorsByComment,
	type CommentRangePlaceKind,
	type ICommentRange,
	rangePlaceKindOf,
	storedAnchorOf
} from './comment-anchor.model';

/** One block's thread, plus whether the block still exists in the document. */
export interface IBlockThread {
	blockId: string;
	nodes: ICommentThreadNode[];
	/** Open comment count — what the rail badge and the editor gutter both key off. */
	openCount: number;
	/** The anchored block was deleted from the document; the thread survives (spec 05 §8). */
	detached: boolean;
}

/** How a thread made on a range of text reads in the rail. */
export interface IThreadRangeView {
	kind: CommentRangePlaceKind;
	/** The text the range covers now; the text it was made on once that is gone. */
	text: string;
}

/** The platform's answer for a comment that is not one of the page's (the route exists). */
const DOCS_COMMENT_NOT_FOUND = 'DOCS_COMMENT_NOT_FOUND';

/**
 * Logs a range failure that is neither "no ranges here" (404) nor a refusal (403): the thread stays on its block either
 * way, but a broken range store must not go unnoticed.
 */
function warnUnexpected(message: string, error: unknown): void {
	const status = (error as { status?: number } | null)?.status;
	if (status !== 404 && status !== 403) console.warn(message, error);
}

/**
 * A 404: the platform has no ranges, unless it names the comment.
 *
 * `GET …/comment-anchors` and `PUT …/comments/:commentId/anchor` answer 404 `DOCS_COLLAB_DISABLED` while Docs
 * collaboration is off, and an older platform has no such route (a 404 without a code); only the PUT answers
 * `DOCS_COMMENT_NOT_FOUND`, for a comment that is not one of the page's. A page the caller cannot read fails its
 * comments too: what is switched off is this page's ranges only (`rangesOff` is reset for every page).
 */
function isRangesUnavailable(error: unknown): boolean {
	const failure = error as { status?: number; error?: { code?: unknown } | null } | null;
	return failure?.status === 404 && failure?.error?.code !== DOCS_COMMENT_NOT_FOUND;
}

/**
 * Block-anchored comment threads (spec 05 §8) — the page editor's Comments rail.
 *
 * **Standalone on purpose.** `DocumentPageComponent` is a standalone component behind
 * `loadComponent`, and `DocumentCommentsComponent` is declared in `docs-ui.module.ts`; making
 * this one standalone lets the page mount it without an NgModule edit.
 *
 * Anchoring rides in the comment body's first line rather than in a `metadata` column — the
 * platform `Comment` entity has none, and its whitelisting DTO drops unknown properties (the
 * full reasoning is on `BLOCK_ANCHOR_PATTERN`). Everything else — threading, resolve, the
 * mention fan-out — is the platform's generic `/api/comment`, exactly as the detail panel's
 * document-level thread uses it.
 */
@Component({
	selector: 'gz-docs-block-comments',
	standalone: true,
	imports: [
		CommonModule,
		TranslatePipe,
		NbBadgeModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	// `EmployeesService` is not root-provided in `ui-core/core`; Documents surfaces bring
	// their own instance. One directory per rail means one employee fetch for every composer.
	providers: [DocumentCommentsService, MentionDirectoryService, EmployeesService],
	templateUrl: './block-comment-thread.component.html',
	styleUrls: ['./block-comment-thread.component.scss']
})
export class BlockCommentThreadComponent implements OnChanges {
	@Input() documentId!: ID;
	/** Carried as `entityName` so the mention notification names the document. */
	@Input() documentName?: string;
	/** The block whose thread is expanded; `null` lists every anchored thread. */
	@Input() blockId: string | null = null;
	/** `blockId`s currently present in the document — anything else is a detached thread. */
	@Input() knownBlockIds: readonly string[] | null = null;
	/**
	 * The selected text a new thread is made on (`docs-collaboration` FR-16): posted on the block it is in, with the
	 * range stored beside the comment. `null` comments on the block.
	 */
	@Input() range: IDocumentCommentAnchorInput | null = null;
	/** The thread (its first comment) asked for: from its highlight in the editor. */
	@Input() activeThreadId: string | null = null;
	/** Where each range thread is in the editor's document now, by thread (the editor finds them again as it is edited). */
	@Input() rangePlaces: ReadonlyMap<string, IDocumentCommentAnchorPosition> | null = null;

	/**
	 * Anchors with at least one unresolved comment, on a thread without a range — feeds the editor's gutter decorations.
	 * The threads with a range are in `rangesChanged`.
	 */
	@Output() openBlocksChanged = new EventEmitter<string[]>();
	/** The open threads made on a range of text, oldest first: the editor highlights their text. */
	@Output() rangesChanged = new EventEmitter<ICommentRange[]>();
	/** The user asked to jump to a block (thread header click). */
	@Output() blockFocused = new EventEmitter<string>();
	/** The user asked to see a thread's text in the page (its quote clicked). */
	@Output() rangeFocused = new EventEmitter<string>();
	/**
	 * The selection handed in as `range` is done with (its thread was posted, or the person chose the whole block): the
	 * page lets go of it, so a rail drawn again does not offer it once more.
	 */
	@Output() rangeDone = new EventEmitter<void>();

	@ViewChild('composerInput') private composerRef?: ElementRef<HTMLTextAreaElement>;

	private readonly commentsService = inject(DocumentCommentsService);
	private readonly directory = inject(MentionDirectoryService);
	private readonly toastrService = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly store = inject(Store);
	private readonly changeDetectorRef = inject(ChangeDetectorRef);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly injector = inject(Injector);

	public threads: IBlockThread[] = [];
	public loading = false;
	public loadError = false;
	public posting = false;
	public busyIds = new Set<string>();

	/** Composer state — a deliberately small copy of `CommentComposerComponent` (NgModule-declared). */
	public draft = '';
	public suggestions: IMentionCandidate[] = [];
	public activeIndex = 0;
	public mentionsOpen = false;

	private mentioned: IMentionCandidate[] = [];
	private token: IMentionToken | null = null;
	private sequence = 0;
	/** Every comment on the document, block-anchored or not — the grouping source. */
	private all: IComment[] = [];

	/** The ranges of the page's threads, by their first comment (none on a platform without ranges). */
	private anchors = new Map<string, IDocumentCommentAnchorResolved>();
	/** The platform answered that it keeps no ranges: it is not asked again for this page. */
	private rangesOff = false;
	/** The selection the composer's next thread is made on (cleared once posted, or by the person). */
	private pendingRange: IDocumentCommentAnchorInput | null = null;
	/** How each range thread reads, by its first comment. */
	public rangeViews = new Map<string, IThreadRangeView>();
	/** The thread the rail scrolls to next (the latest asked for). */
	private scrollTarget: string | null = null;

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['range']) this.pendingRange = this.range ?? null;
		if (changes['documentId'] && this.documentId) {
			if (!changes['range'] && !changes['documentId'].firstChange) this.pendingRange = null;
			this.anchors = new Map();
			this.rangesOff = false;
			void this.reload();
			return;
		}
		// A block came into (or left) focus, or the document's block set changed after an
		// edit — regroup from what is already loaded rather than re-fetching.
		if (changes['blockId'] || changes['knownBlockIds']) this.regroup();
		else if (changes['activeThreadId']) this.publishRanges();
		if (changes['rangePlaces']) this.refreshRangeViews();
		if (changes['activeThreadId'] && this.activeThreadId) this.scrollToThread(this.activeThreadId);
		this.changeDetectorRef.markForCheck();
	}

	// ─── Loading ─────────────────────────────────────────────────

	async reload(): Promise<void> {
		if (!this.documentId) return;
		const documentId = this.documentId;
		this.loading = true;
		this.loadError = false;
		this.changeDetectorRef.markForCheck();
		try {
			// The ranges are read beside the comments; ranges that cannot be read leave the threads on their blocks.
			const [page, anchors] = await Promise.all([
				firstValueFrom(this.commentsService.getAll(documentId)),
				this.loadAnchors(documentId)
			]);
			if (String(this.documentId) !== String(documentId)) return;
			this.all = page?.items ?? [];
			this.anchors = anchors;
			this.regroup();
			// The thread asked for may have come in with the page, or while it loaded: it exists only now.
			if (this.activeThreadId) this.scrollToThread(this.activeThreadId);
		} catch {
			this.loadError = true;
			this.all = [];
			this.threads = [];
		} finally {
			this.loading = false;
			this.changeDetectorRef.markForCheck();
		}
	}

	// ─── Permission gates (identical rules to the document-level thread) ──

	get currentEmployeeId(): string | null {
		const user = this.store.user;
		const employeeId = user?.employee?.id ?? user?.employeeId;
		return employeeId ? String(employeeId) : null;
	}

	get canComment(): boolean {
		return this.store.hasPermission(PermissionsEnum.DOCS_READ) && !!this.currentEmployeeId;
	}

	isOwn(comment: IComment): boolean {
		const authorId = comment?.employeeId ?? comment?.employee?.id;
		return !!authorId && String(authorId) === this.currentEmployeeId;
	}

	/** 🛑 `CommentService.update()` matches on `{ id, employeeId }` — resolve is author-only. */
	canResolve(comment: IComment): boolean {
		return this.canComment && this.isOwn(comment);
	}

	isBusy(comment: IComment): boolean {
		return this.busyIds.has(String(comment?.id));
	}

	// ─── Presentation ────────────────────────────────────────────

	authorLabel(comment: IComment): string {
		return employeeMentionLabel(comment?.employee) || this.translate.instant('DOCS.COMMENTS.UNKNOWN_AUTHOR');
	}

	body(comment: IComment): string {
		return commentBody(comment);
	}

	trackThread(_: number, thread: IBlockThread): string {
		return thread.blockId;
	}

	trackNode(_: number, node: ICommentThreadNode): string {
		return String(node.comment.id);
	}

	trackComment(_: number, comment: IComment): string {
		return String(comment.id);
	}

	focusBlock(thread: IBlockThread): void {
		if (!thread.detached) this.blockFocused.emit(thread.blockId);
	}

	/** Shows a thread's text in the page, while it is there. */
	focusRange(comment: IComment): void {
		const id = String(comment?.id ?? '');
		if (this.rangeViews.get(id)?.kind === 'range') this.rangeFocused.emit(id);
	}

	isActiveThread(comment: IComment): boolean {
		return !!this.activeThreadId && String(comment?.id) === String(this.activeThreadId);
	}

	/** The selection the next thread is made on, when the platform keeps ranges and it is in the block in focus. */
	get composerRange(): IDocumentCommentAnchorInput | null {
		const range = this.pendingRange;
		if (!range || this.rangesOff || !this.blockId || range.blockId !== this.blockId) return null;
		return range;
	}

	/** The person would rather comment on the whole block. */
	clearRange(): void {
		this.releaseRange();
		this.changeDetectorRef.markForCheck();
	}

	// ─── Posting ─────────────────────────────────────────────────

	get canSubmit(): boolean {
		return !this.posting && !!this.blockId && this.draft.trim().length > 0;
	}

	async post(): Promise<void> {
		if (!this.canSubmit || !this.canComment) return;
		const text = this.draft.trim();
		const range = this.composerRange;
		// The page the thread is posted on: another one may be open by the time the requests answer.
		const documentId = this.documentId;
		this.posting = true;
		this.changeDetectorRef.markForCheck();
		try {
			const created = await firstValueFrom(
				this.commentsService.create({
					entity: BaseEntityEnum.Document,
					entityId: documentId,
					entityName: this.documentName,
					// The anchor is the first line of the body — see `withBlockAnchor`.
					comment: withBlockAnchor(this.blockId, text),
					mentionEmployeeIds: collectMentionEmployeeIds(text, this.mentioned)
				})
			);
			// The block's line stays: a client that knows no ranges keeps the thread on its block.
			if (range && created?.id) await this.placeRange(documentId, created.id, range);
			this.toastrService.success(this.translate.instant('DOCS.COMMENTS.TOAST_POSTED'));
			// Another page opened meanwhile: its draft and its selection are its own.
			if (!this.isCurrent(documentId)) return;
			this.all = [...this.all, created];
			this.resetComposer();
			this.regroup();
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.posting = false;
			this.changeDetectorRef.markForCheck();
		}
	}

	async toggleResolved(comment: IComment): Promise<void> {
		if (!this.canResolve(comment) || this.isBusy(comment)) return;
		const resolved = !comment.resolved;
		this.markBusy(comment, true);
		try {
			await firstValueFrom(
				this.commentsService.update(comment.id as ID, {
					resolved,
					// Not derived server-side — an unresolve that left `resolvedAt` behind
					// reads as "resolved" in every export.
					resolvedAt: resolved ? new Date() : (null as unknown as Date)
				})
			);
			this.all = this.all.map((entry) =>
				String(entry.id) === String(comment.id) ? { ...entry, resolved } : entry
			);
			this.regroup();
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.markBusy(comment, false);
		}
	}

	// ─── Composer (`@` mentions) ─────────────────────────────────

	async onInput(event: Event): Promise<void> {
		const target = event.target as HTMLTextAreaElement;
		this.draft = target.value;
		this.token = detectMentionToken(this.draft, target.selectionStart ?? this.draft.length);
		if (!this.token) {
			this.closeMentions();
			return;
		}
		const mySequence = ++this.sequence;
		const candidates = await firstValueFrom(this.directory.search(this.token.query));
		if (mySequence !== this.sequence || !this.token) return;
		this.suggestions = candidates;
		this.activeIndex = 0;
		this.mentionsOpen = candidates.length > 0;
		this.changeDetectorRef.markForCheck();
	}

	onKeyDown(event: KeyboardEvent): void {
		if (this.mentionsOpen && this.suggestions.length) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				this.activeIndex = (this.activeIndex + 1) % this.suggestions.length;
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				this.activeIndex = (this.activeIndex - 1 + this.suggestions.length) % this.suggestions.length;
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				this.pick(this.suggestions[this.activeIndex]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				this.closeMentions();
				return;
			}
		}
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			void this.post();
		}
	}

	/** `mousedown`, not `click`: the textarea's blur would close the menu first. */
	pick(candidate?: IMentionCandidate, event?: Event): void {
		event?.preventDefault();
		if (!candidate || !this.token) return;
		const element = this.composerRef?.nativeElement;
		const caret = element?.selectionStart ?? this.draft.length;
		const applied = applyMentionPick(this.draft, this.token, caret, candidate.label);
		this.draft = applied.text;
		if (!this.mentioned.some((entry) => String(entry.id) === String(candidate.id))) {
			this.mentioned = [...this.mentioned, candidate];
		}
		this.closeMentions();
		if (element) {
			element.value = this.draft;
			element.focus();
			element.setSelectionRange(applied.caret, applied.caret);
		}
	}

	closeMentions(): void {
		this.mentionsOpen = false;
		this.suggestions = [];
		this.activeIndex = 0;
		this.token = null;
		this.changeDetectorRef.markForCheck();
	}

	// ─── Internals ───────────────────────────────────────────────

	/**
	 * Rebuilds the block groups from the loaded page and republishes the open-anchor set.
	 *
	 * `knownBlockIds` is only trusted when it is actually supplied: before the editor has
	 * reported its blocks, treating "not in the list" as "deleted" would flag every thread
	 * as detached.
	 */
	private regroup(): void {
		const known = this.knownBlockIds?.length ? new Set(this.knownBlockIds.map(String)) : null;
		const grouped = groupCommentsByBlock(this.all);
		const focused = this.blockId ? String(this.blockId) : null;

		// A focused block with no comments yet still gets an (empty) thread so the composer
		// has something to sit under.
		if (focused && !grouped.has(focused)) grouped.set(focused, []);

		this.threads = [...grouped]
			.filter(([blockId]) => !focused || blockId === focused)
			.map(([blockId, comments]) => ({
				blockId,
				nodes: buildCommentThread(comments),
				openCount: comments.filter((comment) => !comment.resolved).length,
				detached: !!known && !known.has(blockId)
			}));

		// Threads made on a range are lit on their text (`rangesChanged`), not as a tinted block.
		const present = new Set(this.all.map((comment) => String(comment.id)));
		const onBlocks = this.all.filter((comment) => !this.anchors.has(this.threadIdOf(comment, present)));
		this.openBlocksChanged.emit(openBlockAnchors(onBlocks));
		this.publishRanges();
		this.refreshRangeViews();
		this.changeDetectorRef.markForCheck();
	}

	private resetComposer(): void {
		this.draft = '';
		this.mentioned = [];
		this.releaseRange();
		this.closeMentions();
	}

	/** Lets go of the selection the composer was offering, and tells the page. */
	private releaseRange(): void {
		if (!this.pendingRange) return;
		this.pendingRange = null;
		this.rangeDone.emit();
	}

	// ─── Ranges (`docs-collaboration` FR-16) ─────────────────────

	/** The page's ranges; none when the platform keeps none (404, not asked again) or they cannot be read. */
	private async loadAnchors(documentId: ID): Promise<Map<string, IDocumentCommentAnchorResolved>> {
		if (this.rangesOff) return new Map();
		try {
			const list = await firstValueFrom(this.commentsService.anchors(documentId));
			return anchorsByComment(list?.items);
		} catch (error) {
			if (isRangesUnavailable(error) && this.isCurrent(documentId)) this.rangesOff = true;
			else warnUnexpected('Comment ranges could not be read', error);
			return new Map();
		}
	}

	/** Whether `documentId` is still the page the rail shows. */
	private isCurrent(documentId: ID): boolean {
		return String(this.documentId) === String(documentId);
	}

	/**
	 * Stores the range of a thread just posted. Never in the way of the comment: a platform without ranges (404) is not
	 * asked again, and any other refusal (a page shared for viewing only) leaves the thread on its block.
	 */
	private async placeRange(documentId: ID, commentId: ID, range: IDocumentCommentAnchorInput): Promise<void> {
		try {
			const stored = await firstValueFrom(this.commentsService.setAnchor(documentId, commentId, range));
			const anchor: IDocumentCommentAnchorResolved = stored?.position
				? stored
				: {
						...storedAnchorOf(range),
						commentId,
						documentId,
						position: {
							status: DocumentCommentAnchorStatusEnum.EXACT,
							method: DocumentCommentAnchorMethodEnum.OFFSETS,
							blockId: range.blockId,
							start: range.start,
							end: range.end,
							text: range.quote
						}
					};
			if (this.isCurrent(documentId)) this.anchors = new Map(this.anchors).set(String(commentId), anchor);
		} catch (error) {
			if (isRangesUnavailable(error) && this.isCurrent(documentId)) this.rangesOff = true;
			else warnUnexpected('A comment range could not be stored; the thread stays on its block', error);
		}
	}

	/** The id of the thread a comment is in: its parent's when that is on the page, else its own. */
	private threadIdOf(comment: IComment, present: ReadonlySet<string>): string {
		const parentId = comment?.parentId ? String(comment.parentId) : null;
		return parentId && present.has(parentId) ? parentId : String(comment?.id);
	}

	/**
	 * The open threads made on a range of text, oldest first, to the editor (the one asked for even when resolved, so
	 * its text is lit).
	 *
	 * The rail still shows the text of every range thread, resolved ones included (`refreshRangeViews`): a thread whose
	 * comments are all resolved stays readable where it was, but is lit in the page only while it is the one asked for.
	 */
	private publishRanges(): void {
		const present = new Set(this.all.map((comment) => String(comment.id)));
		// A thread is open while any of its comments is (a reply can stay open on a resolved first comment).
		const open = new Set(
			this.all.filter((comment) => !comment.resolved).map((comment) => this.threadIdOf(comment, present))
		);
		const ranges: ICommentRange[] = [];
		for (const comment of this.all) {
			const id = String(comment?.id);
			const anchor = this.anchors.get(id);
			// A reply has no range of its own: it is on its thread's.
			if (!anchor || this.threadIdOf(comment, present) !== id) continue;
			if (!open.has(id) && id !== String(this.activeThreadId ?? '')) continue;
			ranges.push({
				threadId: id,
				blockId: commentBlockId(comment) ?? anchor.blockId,
				anchor: storedAnchorOf(anchor)
			});
		}
		this.rangesChanged.emit(ranges);
	}

	/** How each range thread reads: where the editor finds it now, else where the platform found it. */
	private refreshRangeViews(): void {
		const views = new Map<string, IThreadRangeView>();
		for (const [id, anchor] of this.anchors) {
			const place = this.rangePlaces?.get(id) ?? anchor.position ?? null;
			const kind = rangePlaceKindOf(place);
			views.set(id, { kind, text: (kind === 'range' ? place?.text : null) || anchor.quote });
		}
		this.rangeViews = views;
	}

	/** Brings the thread asked for into sight in the rail, once it is drawn. */
	private scrollToThread(threadId: string): void {
		this.scrollTarget = threadId;
		afterNextRender(
			{
				read: () => {
					// Asked for another thread meanwhile: that one's own scroll follows.
					if (this.scrollTarget !== threadId) return;
					const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(threadId) : threadId;
					const element = this.host.nativeElement?.querySelector?.<HTMLElement>(
						`[data-thread-id="${escaped}"]`
					);
					if (typeof element?.scrollIntoView === 'function') {
						element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					}
				}
			},
			{ injector: this.injector }
		);
	}

	private markBusy(comment: IComment, busy: boolean): void {
		const id = String(comment?.id);
		// A new Set keeps `isBusy()` honest under OnPush.
		const next = new Set(this.busyIds);
		if (busy) next.add(id);
		else next.delete(id);
		this.busyIds = next;
		this.changeDetectorRef.markForCheck();
	}
}
