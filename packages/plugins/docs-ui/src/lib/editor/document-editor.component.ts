import { CommonModule, isPlatformBrowser } from '@angular/common';
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
	SimpleChanges,
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
import { stripDataUrlImages } from './extensions/base64-guard.plugin';
import { collectBlockIds, setCommentedBlocks } from './extensions/block-comments.plugin';
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

const READ_WPM = 200;

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
	imports: [CommonModule, TextBubbleMenuComponent, TableBubbleMenuComponent, FloatingBlockMenuComponent],
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
	 * A block's comment thread was requested — from the bubble menu's comment action or
	 * from a gutter marker (spec 05 §8). The page chrome owns the Comments rail.
	 */
	@Output() commentRequested = new EventEmitter<string>();
	/**
	 * `metadata.schemaVersion` of the content just loaded — `null` for content saved before
	 * the stamp existed (spec 05 §9.1). The page warns when it is ahead of this build.
	 */
	@Output() schemaVersionChanged = new EventEmitter<number | null>();

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
			this.editor.setEditable(this.editable);
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

	/** Manual flush (Ctrl/Cmd+S, route leave). */
	flush(options: { forceSnapshot?: boolean } = {}): Promise<boolean> {
		return this.autosave.flush(options);
	}

	/**
	 * The page released the lock — resume autosaving. The 423 freeze has no
	 * self-clearing path, so nothing short of a reload would lift it otherwise.
	 */
	lockReleased(document?: IDocument): void {
		this.autosave.lockReleased((document ?? this.document)?.updatedAt as never);
	}

	/** Replaces content without emitting (conflict reload / version restore). */
	applyRemoteContent(document: IDocument): void {
		if (!this.editor) return;
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
		setCommentedBlocks(this.editor, blockIds);
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
		(this.editor.commands as unknown as { toggleInvisibleCharacters?: () => boolean }).toggleInvisibleCharacters?.();
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
		this.suggestionHost.close();
		this.uploadService.destroy();
		// Unconditional destroy — leaked ProseMirror views hold DOM references (spec 05 §3.8).
		this.editor?.destroy();
		this.editor = null;
		this.currentDocumentId = null;
	}

	private createEditor(): void {
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
			onOpenCommentThread: (blockId) => this.zone.run(() => this.commentRequested.emit(blockId)),
			collab: false
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
				editable: this.editable,
				extensions: [...extensions, keymap],
				content: (this.document?.contentJson as never) ?? this.document?.contentHtml ?? '',
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
						this.autosave.markDirty();
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
		this.loadedSchemaVersion = readSchemaVersion(this.document);
		this.schemaVersionChanged.emit(this.loadedSchemaVersion);
		// Fire-and-forget: the chunk lands well inside the 2 s autosave debounce, and a
		// failure only costs the reserved `contentBinary` field.
		void loadCrdtEncoder().then((encoder) => (this.crdtEncoder = encoder));
		// `content`, `aria-label` and `currentDocumentId` above all optional-chain
		// `this.document`; this line dereferenced it bare, so the one path those guards
		// exist for (constructed via `afterNextRender` before the input is bound) threw
		// here instead. Skip the autosave session rather than start one with no id.
		if (this.document) {
			this.autosave.init(this.document.id, this.document.updatedAt as never, () => this.buildPayload());
		}
		this.cdr.markForCheck();
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
			| { characterCount?: { characters?: () => number; words?: () => number } }
			| undefined;
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
