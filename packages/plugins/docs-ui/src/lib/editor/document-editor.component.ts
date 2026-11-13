import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	Injector,
	Input,
	NgZone,
	OnChanges,
	OnDestroy,
	Output,
	PLATFORM_ID,
	type SimpleChanges,
	ViewChild,
	afterNextRender,
	inject
} from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Editor, Extension } from '@tiptap/core';
import { firstValueFrom } from 'rxjs';
import { ID, IDocument, JsonData } from '@gauzy/contracts';
import type { IDocumentCommentAnchorInput, IDocumentCommentAnchorPosition } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DocsLiveService } from '../services/docs-live.service';
import { DocumentsService } from '../services/documents.service';
import type { ILiveBinding, ILiveState } from './live/document-live.binding';
import { stripDataUrlImages } from './extensions/base64-guard.plugin';
import { type ICommentRange, rangePlaceKindOf } from './comments/comment-anchor.model';
import {
	collectBlockIds,
	commentRangeBounds,
	enclosingBlockId,
	setActiveCommentThread,
	setCommentRanges,
	setCommentedBlocks
} from './extensions/block-comments.plugin';
import { selectionCommentAnchor } from './extensions/comment-ranges';
import { createDocumentEditorExtensions } from './extensions/document-extensions';
import { DOCS_EDITOR_SCHEMA_VERSION } from './editor.constants';
import { FloatingBlockMenuComponent } from './menus/floating-block-menu.component';
import { TableBubbleMenuComponent } from './menus/table-bubble-menu.component';
import { TextBubbleMenuComponent } from './menus/text-bubble-menu.component';
import { DocumentAutosaveService, DocsSaveState, IAutosavePayload } from './services/document-autosave.service';
import { ICrdtEncoder, encodeContentBinary, loadCrdtEncoder } from './services/document-binary.util';
import { EditorUploadService, sanitizeContentJson } from './services/editor-upload.service';
import { SuggestionHostService } from './suggestion/suggestion-host.service';
import { collectEmployeeMentionIds } from './suggestion/employee-mention.suggestion';
import { UrlPromptDialogComponent } from './dialogs/url-prompt-dialog.component';

export interface IEditorStats {
	characters: number;
	words: number;
	readTimeMinutes: number;
}

export interface ITocAnchor {
	id: string;
	level: number;
	textContent: string;
	isActive?: boolean;
	isScrolledOver?: boolean;
	dom?: HTMLElement;
}

/** What the page is asked to open in its Comments rail. */
export interface IDocsCommentRequest {
	/** The block whose threads to show. */
	blockId: string;
	/**
	 * The selected text a new thread is made on (the bubble menu's comment action, Mod-Alt-M), when text is selected
	 * (`docs-collaboration` FR-16); `null` comments on the block.
	 */
	range?: IDocumentCommentAnchorInput | null;
	/** The thread asked for: a highlighted range, or the marker of a block lit only by a range. */
	threadId?: string | null;
}

/** What the rail last pushed into the editor: drawn again on an editor rebuilt for the same page. */
interface ICommentMarks {
	documentId: ID | null;
	open: readonly string[];
	ranges: readonly ICommentRange[];
	activeThread: string | null;
}

const NO_COMMENT_MARKS: ICommentMarks = { documentId: null, open: [], ranges: [], activeThread: null };

const READ_WPM = 200;

/** The colours co-editors' cursors are drawn in, picked by user id. */
const LIVE_COLORS = ['#3366ff', '#00b887', '#ff7a45', '#9254de', '#f5222d', '#13c2c2', '#fa8c16', '#2f54eb'];

/** A connection id for one editor instance: 32 letters and digits (the server takes 8–64 of `[A-Za-z0-9_-]`). */
function newConnectionId(): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
	return random.replace(/[^A-Za-z0-9]/g, '').padEnd(16, '0').slice(0, 32);
}

/**
 * Reads `metadata.schemaVersion` off a loaded document (spec 05 §9.1).
 *
 * `null` means the content predates the stamp — it is NOT the same as version 1, and a loader
 * shim has to treat it as "unknown, assume the oldest schema".
 */
function readSchemaVersion(document: IDocument | null | undefined): number | null {
	const metadata = document?.metadata as { schemaVersion?: unknown } | null | undefined;
	const version = metadata?.schemaVersion;
	return typeof version === 'number' && Number.isFinite(version) ? version : null;
}

/**
 * Tier 2 — `gz-document-editor` (spec 05 §4–§9): the full TipTap v3 block
 * editor for `Document.kind = PAGE`. JSON canonical output; autosave via
 * `DocumentAutosaveService`; uploads via `EditorUploadService`; slash menu,
 * mentions and emoji through one shared suggestion host; bubble/floating menus
 * positioned by `@floating-ui/dom`.
 */
@Component({
	selector: 'gz-document-editor',
	standalone: true,
	imports: [TextBubbleMenuComponent, TableBubbleMenuComponent, FloatingBlockMenuComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [DocumentAutosaveService, EditorUploadService, SuggestionHostService],
	templateUrl: './document-editor.component.html',
	styleUrls: ['./document-editor.component.scss']
})
export class DocumentEditorComponent implements OnChanges, OnDestroy {
	@Input({ required: true }) document!: IDocument;
	@Input() editable = true;

	/** Every doc-changing transaction: canonical JSON + derived HTML. */
	@Output() contentChanged = new EventEmitter<{ json: JsonData; html: string }>();
	@Output() saveStateChanged = new EventEmitter<DocsSaveState>();
	@Output() tocChanged = new EventEmitter<ITocAnchor[]>();
	@Output() statsChanged = new EventEmitter<IEditorStats>();
	@Output() created = new EventEmitter<Editor>();
	/**
	 * A block's comment thread was requested — from the bubble menu's comment action (with the
	 * selected text the thread is made on), from a gutter marker, or from a highlighted comment
	 * range (with its thread) (spec 05 §8, `docs-collaboration` FR-16). The page chrome owns the
	 * Comments rail.
	 */
	@Output() commentRequested = new EventEmitter<IDocsCommentRequest>();
	/**
	 * Where each comment range is in the document now, by thread, each time the ranges are found again after edits
	 * (the rail shows the text a thread is on now).
	 */
	@Output() commentRangesResolved = new EventEmitter<ReadonlyMap<string, IDocumentCommentAnchorPosition>>();
	/**
	 * `metadata.schemaVersion` of the content just loaded — `null` for content saved before
	 * the stamp existed (spec 05 §9.1). The page warns when it is ahead of this build.
	 */
	@Output() schemaVersionChanged = new EventEmitter<number | null>();
	/**
	 * Where the page's live session stands (`docs-collaboration` T18): `null` while the editor saves on its own (live
	 * editing is off on the platform, or the session ended and the editor fell back to autosave).
	 */
	@Output() liveStateChanged = new EventEmitter<ILiveState | null>();

	@ViewChild('editorHost', { static: true }) editorHostRef!: ElementRef<HTMLElement>;
	@ViewChild('fileInput', { static: true }) fileInputRef!: ElementRef<HTMLInputElement>;

	public readonly autosave = inject(DocumentAutosaveService);
	public readonly uploadService = inject(EditorUploadService);
	private readonly suggestionHost = inject(SuggestionHostService);
	private readonly injector = inject(Injector);
	private readonly translate = inject(TranslateService);
	private readonly dialogService = inject(NbDialogService);
	private readonly announcer = inject(LiveAnnouncer);
	private readonly zone = inject(NgZone);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly liveSessions = inject(DocsLiveService);
	private readonly documents = inject(DocumentsService);
	private readonly store = inject(Store);

	/** The live session this editor is bound to, when the platform serves one. */
	private liveBinding: ILiveBinding | null = null;

	/** Where the live session stands, for the status line; `null` when not live. */
	public liveState: ILiveState | null = null;

	/** The page whose live session ended: it is edited with autosave until it is opened again. */
	private liveEndedFor: ID | null = null;

	/**
	 * `updatedAt` of the page when its live session began. Edits the session never took are saved against it once the
	 * session ends (`fallBackToAutosave`): any write since, the session's own saves included, meets them as a conflict
	 * the person resolves, so neither copy silently replaces the other.
	 */
	private liveBaseUpdatedAt: string | Date | null = null;

	/** Bumps on every build, so a build that awaited something does not finish after a newer one started. */
	private buildGeneration = 0;

	public editor: Editor | null = null;
	public invisiblesVisible = false;

	/** The document the live TipTap view and the autosave session were built for. */
	private currentDocumentId: ID | null = null;

	/**
	 * `metadata.schemaVersion` of the JSON currently loaded (spec 05 §9.1). Content saved
	 * before the stamp existed reads as `null`; saves always write the current version, so a
	 * future loader shim can tell "pre-1" from "1" without guessing.
	 */
	public loadedSchemaVersion: number | null = null;

	/**
	 * The lazily-fetched Yjs encoder behind `contentBinary`. Kicked off when the editor is
	 * built so it is ready long before the 2 s debounce fires; a save that beats it simply
	 * ships without the reserved field, and the next one carries it.
	 */
	private crdtEncoder: ICrdtEncoder | null = null;

	/** What the rail last pushed in (open blocks, ranges, the lit thread), drawn again when the editor is rebuilt. */
	private commentMarks: ICommentMarks = NO_COMMENT_MARKS;

	/** The comment range places last told to the page, so an unchanged answer is not sent again. */
	private lastRangePlaces = '';

	/**
	 * A thread asked for before its range was handed in (a resolved thread is lit only once the rail knows it is the
	 * one asked for): it is scrolled to when its range arrives.
	 */
	private pendingRangeFocus: string | null = null;

	constructor() {
		// A real DOM is required — construct only in the browser (spec 05 §3.8).
		afterNextRender(() => {
			if (isPlatformBrowser(this.platformId)) this.createEditor();
		});
		this.autosave.state$.subscribe((state) => {
			this.saveStateChanged.emit(state);
			this.announceSaveState(state);
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['editable'] && this.editor) {
			// A live editor writes only while its session does.
			const liveWrites = !this.liveBinding || (this.liveState?.phase === 'live' && !this.liveState.readOnly);
			this.editor.setEditable(this.editable && liveWrites);
		}
		if (changes['document'] && this.document) {
			this.uploadService.parentDocumentId = this.document.id ?? null;
			// The `page/:id` route reuses this component instance across documents:
			// without a rebuild the view keeps rendering the previous document and
			// autosave keeps writing into its id (spec 05 §9.2).
			if (this.editor && (this.document.id ?? null) !== this.currentDocumentId) {
				this.rebuildEditor();
			}
		}
	}

	ngOnDestroy(): void {
		this.teardownEditor();
	}

	// ─── Public API (page chrome) ────────────────────────────────

	getJSON(): JsonData {
		return (this.editor ? sanitizeContentJson(this.editor.getJSON()) : null) as JsonData;
	}

	getHTML(): string {
		return this.editor?.getHTML() ?? '';
	}

	/** "Copy as Markdown" / `.md` export via `@tiptap/markdown` (spec 05 §9.3). */
	getMarkdown(): string {
		const storage = this.editor?.storage as { markdown?: { getMarkdown?: () => string } } | undefined;
		try {
			return storage?.markdown?.getMarkdown?.() ?? this.editor?.getText() ?? '';
		} catch {
			return this.editor?.getText() ?? '';
		}
	}

	focus(position: 'start' | 'end' = 'end'): void {
		this.editor?.chain().focus(position).run();
	}

	/** Manual flush (Ctrl/Cmd+S, route leave). A live page is saved by the server: nothing to flush here. */
	flush(options: { forceSnapshot?: boolean } = {}): Promise<boolean> {
		// A live page is saved by the server; what is left here is the edits not sent yet.
		if (this.liveBinding) return this.liveBinding.flush();
		return this.autosave.flush(options);
	}

	/** Whether the editor holds edits the server has not taken: unsaved autosave content, or live edits not sent yet. */
	get hasUnsavedChanges(): boolean {
		// Live, a batch the server refused or never took counts too: leaving would drop it.
		return this.liveBinding ? this.liveBinding.hasUnconfirmed() : this.autosave.isDirty;
	}

	/**
	 * Waits until the page holds no unsaved edit: the autosave's save in flight lands and what came after is saved,
	 * or, live, the waiting edits are sent.
	 *
	 * @returns `false` when some are still unsaved (a freeze, a failure, the deadline).
	 */
	settleSaves(): Promise<boolean> {
		return this.liveBinding ? this.liveBinding.flush() : this.autosave.settle();
	}

	/**
	 * The page's row was written by a metadata change (a move to another space): the autosave continues from its new
	 * `updatedAt`. A live page has no token to move.
	 *
	 * @param document The row as written.
	 */
	rebaseSaveToken(document: IDocument): void {
		if (!this.liveBinding) this.autosave.rebase(document?.updatedAt as never);
	}

	/** Whether the editor is bound to a live session of the page. */
	get isLive(): boolean {
		return !!this.liveBinding && this.liveState?.phase === 'live';
	}

	/**
	 * The page released the lock — resume autosaving. The 423 freeze has no
	 * self-clearing path, so nothing short of a reload would lift it otherwise.
	 */
	lockReleased(document?: IDocument): void {
		// A live session hears of the lock from the server (a `mode` frame).
		if (this.liveBinding) return;
		this.autosave.lockReleased((document ?? this.document)?.updatedAt as never);
	}

	/** Replaces content without emitting (conflict reload / version restore). */
	applyRemoteContent(document: IDocument): void {
		if (!this.editor) return;
		// A live page already shows a server-side write (a restore arrives as an edit of the shared document);
		// setting it again here would be sent back as an edit of its own.
		if (this.liveBinding) return;
		const content = (document.contentJson as never) ?? document.contentHtml ?? '';
		this.editor.commands.setContent(content, { emitUpdate: false } as never);
		this.loadedSchemaVersion = readSchemaVersion(document);
		this.schemaVersionChanged.emit(this.loadedSchemaVersion);
		this.autosave.resolve(document.updatedAt as never, { discardLocal: true });
		this.emitStats();
	}

	// ─── Block comments (spec 05 §8) ─────────────────────────────

	/**
	 * Publishes the blocks that currently have an open thread; the extension turns them into
	 * gutter markers. Called by the page's Comments rail — the editor never fetches comments.
	 */
	setCommentedBlocks(blockIds: readonly string[]): void {
		this.rememberCommentMarks({ open: [...blockIds] });
		setCommentedBlocks(this.editor, blockIds);
	}

	/**
	 * Publishes the open threads made on a range of text (`docs-collaboration` FR-16); the editor highlights their text
	 * where it finds it now, and keeps finding it as the page is edited. Called by the page's Comments rail.
	 */
	setCommentRanges(ranges: readonly ICommentRange[]): void {
		this.rememberCommentMarks({ ranges: [...ranges] });
		setCommentRanges(this.editor, ranges);
		const pending = this.pendingRangeFocus;
		if (pending && ranges.some((range) => range.threadId === pending)) this.focusCommentRange(pending);
	}

	/** Lights one thread's range (or none). */
	setActiveCommentThread(threadId: string | null): void {
		if (threadId !== this.pendingRangeFocus) this.pendingRangeFocus = null;
		this.rememberCommentMarks({ activeThread: threadId });
		setActiveCommentThread(this.editor, threadId);
	}

	/**
	 * Lights a thread's range and scrolls it into view, opening the collapsed toggles it is in.
	 *
	 * @param threadId The thread (its first comment).
	 * @returns False when the thread's text is not lit (yet): the editor scrolls to it once it is (its range handed in,
	 *   the editor built, a live page synced), and the caller shows its block meanwhile when it knows one.
	 */
	focusCommentRange(threadId: string): boolean {
		if (!threadId) return false;
		this.setActiveCommentThread(threadId);
		const editor = this.editor && !this.editor.isDestroyed ? this.editor : null;
		const bounds = editor ? commentRangeBounds(editor.state, threadId) : null;
		this.pendingRangeFocus = bounds ? null : threadId;
		if (!editor || !bounds) return false;
		this.revealCollapsedDetails(editor, bounds.from);
		const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(threadId) : threadId;
		let element = this.editorHostRef?.nativeElement?.querySelector<HTMLElement>(
			`.gz-comment-range[data-thread-id="${escaped}"]`
		);
		if (!element) {
			try {
				const { node } = editor.view.domAtPos(bounds.from);
				element = node instanceof HTMLElement ? node : node.parentElement;
			} catch {
				element = null;
			}
		}
		if (typeof element?.scrollIntoView === 'function')
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		return true;
	}

	/**
	 * Opens the collapsed toggles (`details`) around a position, outermost first, as a click on each toggle would: a
	 * range inside one is in the page but not in sight.
	 */
	private revealCollapsedDetails(editor: Editor, pos: number): void {
		const $pos = editor.state.doc.resolve(pos);
		for (let depth = 1; depth <= $pos.depth; depth += 1) {
			if ($pos.node(depth).type.name !== 'details') continue;
			const dom = editor.view.nodeDOM($pos.before(depth));
			if (!(dom instanceof HTMLElement) || dom.classList.contains('is-open')) continue;
			dom.querySelector<HTMLButtonElement>(':scope > button')?.click();
		}
	}

	/** Every `blockId` in the document — lets the rail flag threads whose block was deleted. */
	getBlockIds(): string[] {
		return collectBlockIds(this.editor);
	}

	/**
	 * Scrolls a block into view and flashes it (deep link `?block=` — spec 05 §8).
	 *
	 * @param blockId The UniqueID attribute value to look for.
	 * @returns True when the block was found and highlighted.
	 */
	highlightBlock(blockId: string): boolean {
		const host = this.editorHostRef?.nativeElement;
		if (!host || !blockId) return false;
		// The attribute is rendered as `data-blockId`, which HTML lowercases; attribute-name
		// matching is case-insensitive in HTML documents, so this selector finds either form.
		const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(blockId) : blockId;
		const element = host.querySelector<HTMLElement>(`[data-blockId="${escaped}"]`);
		if (!element) return false;
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		element.classList.add('gz-block-flash');
		// Self-clearing so a second deep link to the same block flashes again.
		setTimeout(() => element.classList.remove('gz-block-flash'), 2_000);
		return true;
	}

	toggleInvisibleCharacters(): void {
		if (!this.editor) return;
		this.invisiblesVisible = !this.invisiblesVisible;
		(
			this.editor.commands as unknown as { toggleInvisibleCharacters?: () => boolean }
		).toggleInvisibleCharacters?.();
		this.cdr.markForCheck();
	}

	openFilePicker(kind: 'image' | 'file'): void {
		const input = this.fileInputRef.nativeElement;
		input.accept = kind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : '';
		input.value = '';
		input.onchange = () => {
			if (this.editor && input.files?.length) {
				this.uploadService.handleFiles(this.editor, input.files);
			}
			input.onchange = null;
		};
		input.click();
	}

	// ─── Editor construction ─────────────────────────────────────

	/** Swaps the whole editor stack over to `this.document` (route ':id' change). */
	private rebuildEditor(): void {
		this.teardownEditor();
		if (isPlatformBrowser(this.platformId)) this.createEditor();
	}

	private teardownEditor(): void {
		this.buildGeneration += 1;
		this.lastRangePlaces = '';
		this.suggestionHost.close();
		this.uploadService.destroy();
		this.liveBinding?.destroy();
		this.liveBinding = null;
		if (this.liveState) {
			this.liveState = null;
			this.liveStateChanged.emit(null);
		}
		// Unconditional destroy — leaked ProseMirror views hold DOM references (spec 05 §3.8).
		this.editor?.destroy();
		this.editor = null;
		this.currentDocumentId = null;
	}

	/**
	 * Builds the editor: bound to the page's live session when the platform serves one (the binding is loaded on
	 * demand, in its own chunk), otherwise with autosave, as before.
	 */
	private createEditor(): void {
		const generation = ++this.buildGeneration;
		const document = this.document;
		if (!document?.id || this.liveEndedFor === document.id) {
			this.buildEditor(null);
			return;
		}
		void this.liveSessions
			.available()
			.then((available) => (available ? import('./live/document-live.binding') : null))
			.catch(() => null)
			.then((runtime) => {
				if (generation !== this.buildGeneration) return;
				if (String(this.document?.id ?? '') !== String(document.id)) {
					// Another page came in while this one was loading, and no editor existed yet for `ngOnChanges` to
					// rebuild: build for the page the input holds now.
					this.createEditor();
					return;
				}
				if (!runtime) {
					this.buildEditor(null);
					return;
				}
				const connectionId = newConnectionId();
				const documentId = document.id as ID;
				this.buildEditor(
					runtime.createLiveBinding({
						frames: () => this.liveSessions.frames(documentId, connectionId),
						postUpdate: (update) => this.liveSessions.postUpdate(documentId, connectionId, update),
						postAwareness: (awareness) => this.liveSessions.postAwareness(documentId, connectionId, awareness),
						user: this.liveUser(),
						onState: (state) => this.zone.run(() => this.onLiveState(documentId, state))
					})
				);
			});
	}

	/** The name and colour this editor shows to co-editors. */
	private liveUser(): { name: string; color: string } {
		const user = this.store.user;
		const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
		const id = String(user?.id ?? name);
		let hash = 0;
		for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
		return { name, color: LIVE_COLORS[hash % LIVE_COLORS.length] };
	}

	/** Follows the live session: editable while it writes, and back to autosave when it ends. */
	private onLiveState(documentId: ID, state: ILiveState): void {
		if (!this.liveBinding || this.currentDocumentId !== documentId) return;
		this.liveState = state;
		this.liveStateChanged.emit(state);
		this.editor?.setEditable(this.editable && state.phase === 'live' && !state.readOnly);
		if (state.phase === 'ended') {
			if (state.reason === 'lineage' && this.liveBinding.hasUnconfirmed() === false) {
				// The page was rebuilt on the server: join it again with an empty document.
				this.rebuildEditor();
				return;
			}
			// Edits not sent yet do not merge into a rebuilt page either: they are kept, and saved with autosave.
			this.fallBackToAutosave(documentId);
		}
		this.cdr.markForCheck();
	}

	/**
	 * The live session ended: the page is read again and edited with autosave, as without live editing.
	 *
	 * Edits the session never took (a batch not sent yet, a send that failed or is still out) exist only in this
	 * editor. They are read before the binding goes, stay on the page, and autosave saves them against the version the
	 * session began on, so a newer write meets them as a conflict the person resolves. The server's copy never replaces
	 * them unasked.
	 */
	private fallBackToAutosave(documentId: ID): void {
		this.liveEndedFor = documentId;
		const local = this.editor ? { json: this.getJSON(), html: this.editor.getHTML() } : null;
		// Refused edits count too (the page turned read-only, the size limit): the server never took them.
		const unsent = this.liveBinding?.hasUnconfirmed() === true;
		const base = this.liveBaseUpdatedAt;
		this.documents.getById(documentId).subscribe({
			next: (document) => {
				if (this.currentDocumentId !== documentId) return;
				this.document = document;
				this.rebuildEditor();
				if (local && unsent) this.keepLiveContent(local, base, true, true);
			},
			error: () => {
				if (this.currentDocumentId !== documentId) return;
				this.rebuildEditor();
				// The page could not be read: what the live editor showed is the newest copy here, not the one loaded
				// before the session began.
				if (local) this.keepLiveContent(local, base, unsent, false);
			}
		});
	}

	/**
	 * Puts what the live editor showed into the autosave editor that replaced it.
	 *
	 * @param local The live editor's content when its session ended.
	 * @param base The version the session began on: the token the content is saved against.
	 * @param unsaved Whether it holds edits the server never took: they are saved now.
	 * @param read Whether the editor was rebuilt from the page read just now. Otherwise it holds the copy loaded before,
	 *   which equal content does not prove saved: the server may hold a later state the unsent edits undid.
	 */
	private keepLiveContent(
		local: { json: JsonData; html: string },
		base: string | Date | null,
		unsaved: boolean,
		read: boolean
	): void {
		const editor = this.editor;
		if (!editor) return;
		// Nothing to keep when the page just read already holds all of it.
		if (read && JSON.stringify(this.getJSON()) === JSON.stringify(local.json)) return;
		editor.commands.setContent(local.json, { emitUpdate: false });
		if (unsaved) {
			void this.autosave.saveAdopted(base);
		} else {
			this.autosave.rebase(base ?? undefined);
		}
		this.contentChanged.emit({ json: this.getJSON(), html: editor.getHTML() });
		this.emitStats();
		this.cdr.markForCheck();
	}

	private buildEditor(binding: ILiveBinding | null): void {
		this.liveBinding = binding;
		const extensions = createDocumentEditorExtensions({
			injector: this.injector,
			translate: this.translate,
			suggestionHost: this.suggestionHost,
			uploadService: this.uploadService,
			slashCommandDeps: {
				openFilePicker: (kind) => this.openFilePicker(kind),
				promptUrl: (titleKey) => this.promptUrl(titleKey)
			},
			onTocUpdate: (anchors) => this.zone.run(() => this.tocChanged.emit(anchors as ITocAnchor[])),
			onOpenCommentThread: (blockId, threadId) =>
				this.zone.run(() => this.commentRequested.emit({ blockId, threadId: threadId ?? null })),
			onCommentSelection: () => this.zone.run(() => this.commentOnSelection()),
			commentLiveResolver: () => this.liveBinding?.anchorResolver ?? null,
			onCommentRangesResolved: (places) => {
				this.publishRangePlaces(places);
				this.retryRangeFocus(places);
			},
			collab: !!binding
		});

		const keymap = Extension.create({
			name: 'gzEditorKeymap',
			addKeyboardShortcuts: () => ({
				// Manual flush — never the browser save dialog (spec 05 §9.2).
				'Mod-s': () => {
					void this.zone.run(() => this.autosave.flush());
					return true;
				},
				// Block move (spec 05 §13 keyboard equivalents for the drag handle).
				'Alt-ArrowUp': () => this.moveCurrentBlock(-1),
				'Alt-ArrowDown': () => this.moveCurrentBlock(1)
			})
		});

		// TipTap events fire outside Angular's zone; re-enter only to push state (spec 05 §3.8).
		this.zone.runOutsideAngular(() => {
			this.editor = new Editor({
				element: this.editorHostRef.nativeElement,
				// A live editor waits for the session's first `sync` before it takes edits.
				editable: binding ? false : this.editable,
				extensions: [...extensions, ...(binding?.extensions ?? []), keymap],
				// A live editor starts EMPTY: the session's `sync` fills the shared document. Seeding it here would put
				// the page in twice once the server's state merges in.
				content: binding ? undefined : ((this.document?.contentJson as never) ?? this.document?.contentHtml ?? ''),
				editorProps: {
					transformPastedHTML: stripDataUrlImages,
					attributes: {
						role: 'textbox',
						'aria-multiline': 'true',
						'aria-label': this.document?.name ?? '',
						class: 'gz-document-editor-content'
					}
				},
				onUpdate: ({ editor, transaction }) => {
					if (!transaction.docChanged) return;
					this.zone.run(() => {
						// A live page is saved by the server.
						if (!this.liveBinding) this.autosave.markDirty();
						this.contentChanged.emit({ json: this.getJSON(), html: editor.getHTML() });
						this.emitStats();
					});
				},
				onCreate: ({ editor }) => {
					this.zone.run(() => {
						this.created.emit(editor);
						this.emitStats();
						this.cdr.markForCheck();
					});
				}
			});
		});

		this.currentDocumentId = this.document?.id ?? null;
		this.redrawCommentMarks();
		this.loadedSchemaVersion = readSchemaVersion(this.document);
		this.schemaVersionChanged.emit(this.loadedSchemaVersion);
		// Fire-and-forget: the chunk lands well inside the 2 s autosave debounce, and a
		// failure only costs the reserved `contentBinary` field.
		void loadCrdtEncoder().then((encoder) => (this.crdtEncoder = encoder));
		// `content`, `aria-label` and `currentDocumentId` above all optional-chain
		// `this.document`; this line dereferenced it bare, so the one path those guards
		// exist for (constructed via `afterNextRender` before the input is bound) threw
		// here instead. Skip the autosave session rather than start one with no id.
		if (binding) {
			this.liveBaseUpdatedAt = (this.document?.updatedAt as string | Date | undefined) ?? null;
			binding.start();
		} else if (this.document) {
			this.autosave.init(this.document.id, this.document.updatedAt as never, () => this.buildPayload());
		}
		this.cdr.markForCheck();
	}

	// ─── Comment ranges (`docs-collaboration` FR-16) ─────────────

	/**
	 * The bubble menu's comment action: the block the selection starts in, and the selected text as the new thread's
	 * range (with its live relative positions while the page is edited live).
	 */
	requestComment(blockId: string): void {
		if (blockId) this.commentRequested.emit({ blockId, range: this.selectionCommentRange() });
	}

	/** Mod-Alt-M: comment on the selection, as the bubble menu's action does. */
	private commentOnSelection(): void {
		const blockId = enclosingBlockId(this.editor);
		if (blockId) this.requestComment(blockId);
	}

	/** The selection as a comment's range; null without selected text (the comment is then on its block). */
	private selectionCommentRange(): IDocumentCommentAnchorInput | null {
		const state = this.editor?.state;
		if (!state) return null;
		const live =
			this.liveBinding && this.liveState?.phase === 'live' ? this.liveBinding.relativeRange(state) : null;
		return selectionCommentAnchor(state, live);
	}

	/**
	 * Tells the page where the ranges are now. Later than the editor's own update: a rail that pushed ranges in while
	 * the page was being checked would otherwise see one of its inputs change under that same check.
	 */
	private publishRangePlaces(places: ReadonlyMap<string, IDocumentCommentAnchorPosition>): void {
		const key = JSON.stringify([...places]);
		if (key === this.lastRangePlaces) return;
		this.lastRangePlaces = key;
		void Promise.resolve().then(() => this.zone.run(() => this.commentRangesResolved.emit(places)));
	}

	/**
	 * A thread asked for before its text was lit (no editor yet, a live page before its sync) is scrolled to once the
	 * ranges are found with it on the page. Later than the editor's own update, which is still dispatching.
	 */
	private retryRangeFocus(places: ReadonlyMap<string, IDocumentCommentAnchorPosition>): void {
		const pending = this.pendingRangeFocus;
		if (!pending || rangePlaceKindOf(places.get(pending)) !== 'range') return;
		void Promise.resolve().then(() => {
			if (this.pendingRangeFocus === pending) this.zone.run(() => this.focusCommentRange(pending));
		});
	}

	/** Keeps what the rail pushed in, for this page. */
	private rememberCommentMarks(marks: Partial<Omit<ICommentMarks, 'documentId'>>): void {
		const documentId = (this.currentDocumentId ?? this.document?.id ?? null) as ID | null;
		const base =
			String(this.commentMarks.documentId ?? '') === String(documentId ?? '')
				? this.commentMarks
				: { ...NO_COMMENT_MARKS, documentId };
		this.commentMarks = { ...base, ...marks, documentId };
	}

	/** Draws again, on an editor just built, what the rail pushed in for the same page (a live session that ended). */
	private redrawCommentMarks(): void {
		const marks = this.commentMarks;
		if (!this.editor || String(marks.documentId ?? '') !== String(this.currentDocumentId ?? '')) return;
		if (marks.open.length) setCommentedBlocks(this.editor, marks.open);
		if (marks.ranges.length) setCommentRanges(this.editor, marks.ranges);
		if (marks.activeThread) setActiveCommentThread(this.editor, marks.activeThread);
	}

	/** The status line of a live page. */
	get liveStatusText(): string {
		const state = this.liveState;
		if (!state) return '';
		if (state.phase === 'connecting') return this.translate.instant('DOCS.EDITOR.LIVE.CONNECTING');
		if (state.phase === 'ended') return this.translate.instant('DOCS.EDITOR.LIVE.OFF');
		const editing = state.editors.length
			? ` · ${this.translate.instant('DOCS.EDITOR.LIVE.EDITING', { count: state.editors.length + 1 })}`
			: '';
		const readOnly = state.readOnly ? ` · ${this.liveReasonText(state.reason)}` : '';
		return `${this.translate.instant('DOCS.EDITOR.LIVE.ON')}${editing}${readOnly}`;
	}

	private liveReasonText(reason: string | null): string {
		const keys: Record<string, string> = {
			no_write_access: 'DOCS.EDITOR.LIVE.READ_ONLY_NO_ACCESS',
			locked: 'DOCS.EDITOR.LIVE.READ_ONLY_LOCKED',
			session_limit: 'DOCS.EDITOR.LIVE.READ_ONLY_FULL',
			size_limit: 'DOCS.EDITOR.LIVE.READ_ONLY_SIZE'
		};
		return this.translate.instant(keys[reason ?? ''] ?? 'DOCS.EDITOR.LIVE.READ_ONLY');
	}

	private buildPayload(): IAutosavePayload | null {
		if (!this.editor) return null;
		// Never save while an upload placeholder is pending (spec 05 §6.6 step 6).
		if (this.uploadService.hasPending) return null;
		const contentJson = this.getJSON();
		return {
			contentJson,
			contentHtml: this.editor.getHTML(),
			mentionEmployeeIds: collectEmployeeMentionIds(contentJson),
			// Stamped on every save (spec 05 §9.1) — without it, a future loader shim has no
			// discriminator and every page written today is indistinguishable from a v2 one.
			metadata: { schemaVersion: DOCS_EDITOR_SCHEMA_VERSION },
			contentBinary: encodeContentBinary(this.crdtEncoder, this.editor.schema, contentJson)
		};
	}

	private emitStats(): void {
		const storage = this.editor?.storage as
			{ characterCount?: { characters?: () => number; words?: () => number } } | undefined;
		const characters = storage?.characterCount?.characters?.() ?? 0;
		const words = storage?.characterCount?.words?.() ?? 0;
		this.statsChanged.emit({
			characters,
			words,
			readTimeMinutes: Math.max(1, Math.ceil(words / READ_WPM))
		});
	}

	private async promptUrl(titleKey: string): Promise<string | null> {
		const ref = this.dialogService.open(UrlPromptDialogComponent, { context: { titleKey } });
		const result = await firstValueFrom(ref.onClose);
		return typeof result === 'string' ? result : null;
	}

	/** Moves the selection's top-level block one sibling up/down. */
	private moveCurrentBlock(direction: -1 | 1): boolean {
		const editor = this.editor;
		if (!editor || !editor.isEditable) return false;
		return editor.commands.command(({ state, tr, dispatch }) => {
			const { $from } = state.selection;
			const blockDepth = 1;
			if ($from.depth < blockDepth) return false;
			const index = $from.index(blockDepth - 1);
			const parent = $from.node(blockDepth - 1);
			const targetIndex = index + direction;
			if (targetIndex < 0 || targetIndex >= parent.childCount) return false;
			const from = $from.before(blockDepth);
			const node = parent.child(index);
			const sibling = parent.child(targetIndex);
			if (!dispatch) return true;
			const start = direction === -1 ? from - sibling.nodeSize : from;
			tr.delete(from, from + node.nodeSize);
			tr.insert(direction === -1 ? start : start + sibling.nodeSize, node);
			dispatch(tr.scrollIntoView());
			return true;
		});
	}

	private announceSaveState(state: DocsSaveState): void {
		const keyByState: Partial<Record<DocsSaveState, string>> = {
			saved: 'DOCS.EDITOR.SAVED',
			saving: 'DOCS.EDITOR.SAVING',
			offline: 'DOCS.EDITOR.OFFLINE_RETRYING',
			error: 'DOCS.EDITOR.SAVE_FAILED',
			conflict: 'DOCS.EDITOR.SAVE.CONFLICT',
			locked: 'DOCS.EDITOR.LOCKED_BANNER'
		};
		const key = keyByState[state];
		if (key) void this.announcer.announce(this.translate.instant(key), 'polite');
	}
}
