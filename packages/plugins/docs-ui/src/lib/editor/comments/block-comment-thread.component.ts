import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	Input,
	OnChanges,
	Output,
	SimpleChanges,
	ViewChild,
	inject
} from '@angular/core';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbInputModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { BaseEntityEnum, IComment, ID, PermissionsEnum } from '@gauzy/contracts';
import { EmployeesService, Store, ToastrService } from '@gauzy/ui-core/core';
import {
	applyMentionPick,
	buildCommentThread,
	collectMentionEmployeeIds,
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

/** One block's thread, plus whether the block still exists in the document. */
export interface IBlockThread {
	blockId: string;
	nodes: ICommentThreadNode[];
	/** Open comment count — what the rail badge and the editor gutter both key off. */
	openCount: number;
	/** The anchored block was deleted from the document; the thread survives (spec 05 §8). */
	detached: boolean;
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
		TranslateModule,
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

	/** Anchors with at least one unresolved comment — feeds the editor's gutter decorations. */
	@Output() openBlocksChanged = new EventEmitter<string[]>();
	/** The user asked to jump to a block (thread header click). */
	@Output() blockFocused = new EventEmitter<string>();

	@ViewChild('composerInput') private composerRef?: ElementRef<HTMLTextAreaElement>;

	private readonly commentsService = inject(DocumentCommentsService);
	private readonly directory = inject(MentionDirectoryService);
	private readonly toastrService = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly store = inject(Store);
	private readonly changeDetectorRef = inject(ChangeDetectorRef);

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

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['documentId'] && this.documentId) {
			void this.reload();
			return;
		}
		// A block came into (or left) focus, or the document's block set changed after an
		// edit — regroup from what is already loaded rather than re-fetching.
		if (changes['blockId'] || changes['knownBlockIds']) this.regroup();
	}

	// ─── Loading ─────────────────────────────────────────────────

	async reload(): Promise<void> {
		if (!this.documentId) return;
		this.loading = true;
		this.loadError = false;
		this.changeDetectorRef.markForCheck();
		try {
			const page = await firstValueFrom(this.commentsService.getAll(this.documentId));
			this.all = page?.items ?? [];
			this.regroup();
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

	// ─── Posting ─────────────────────────────────────────────────

	get canSubmit(): boolean {
		return !this.posting && !!this.blockId && this.draft.trim().length > 0;
	}

	async post(): Promise<void> {
		if (!this.canSubmit || !this.canComment) return;
		const text = this.draft.trim();
		this.posting = true;
		this.changeDetectorRef.markForCheck();
		try {
			const created = await firstValueFrom(
				this.commentsService.create({
					entity: BaseEntityEnum.Document,
					entityId: this.documentId,
					entityName: this.documentName,
					// The anchor is the first line of the body — see `withBlockAnchor`.
					comment: withBlockAnchor(this.blockId, text),
					mentionEmployeeIds: collectMentionEmployeeIds(text, this.mentioned)
				})
			);
			this.all = [...this.all, created];
			this.resetComposer();
			this.regroup();
			this.toastrService.success(this.translate.instant('DOCS.COMMENTS.TOAST_POSTED'));
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

		this.openBlocksChanged.emit(openBlockAnchors(this.all));
		this.changeDetectorRef.markForCheck();
	}

	private resetComposer(): void {
		this.draft = '';
		this.mentioned = [];
		this.closeMentions();
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
