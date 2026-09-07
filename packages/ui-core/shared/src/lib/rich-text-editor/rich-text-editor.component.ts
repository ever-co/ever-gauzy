import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	Inject,
	Input,
	NgZone,
	OnChanges,
	OnDestroy,
	Output,
	PLATFORM_ID,
	SecurityContext,
	SimpleChanges,
	ViewChild,
	forwardRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import type { Editor, JSONContent } from '@tiptap/core';
import {
	PresetToolbarOptions,
	RichTextEditorPreset,
	RichTextEditorPresetOptions,
	ToolbarGroup
} from './presets/preset.types';
import { normalizeLegacyHtml } from './legacy-html.util';

/**
 * `ga-rich-text-editor` — the shared tier-1 rich-text form control
 * (05-editor-spec.md §3). Wraps a TipTap v3 `Editor` directly (no third-party
 * Angular binding) and implements the full `ControlValueAccessor` contract so it
 * drops into `formControlName` / `[formControl]` / `ngModel` exactly where the
 * legacy CKEditor sites were mounted.
 *
 * - `outputFormat: 'html'` (default) reads/writes HTML strings — legacy-field mode.
 * - `outputFormat: 'json'` reads/writes TipTap JSON documents.
 * - An empty document always maps to `''` so `Validators.required` keeps working.
 * - The editor is instantiated in the browser only; on the server the component
 *   renders a non-interactive sanitized preview of the written HTML value.
 * - The preset (and its extension chunk) is resolved through a dynamic import at
 *   instantiation, so each preset stays its own lazy chunk (§12).
 */
@Component({
	selector: 'ga-rich-text-editor',
	templateUrl: './rich-text-editor.component.html',
	styleUrls: ['./rich-text-editor.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => RichTextEditorComponent),
			multi: true
		}
	]
})
export class RichTextEditorComponent implements AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor {
	/** Selects the extension set + toolbar layout. Not mutable after init. */
	@Input() preset: RichTextEditorPreset = 'standard';
	/** Already-translated placeholder text (callers pass `'…' | translate`). */
	@Input() placeholder = '';
	/** `'html'`: CVA reads/writes HTML strings (legacy-field mode). `'json'`: TipTap JSON. */
	@Input() outputFormat: 'html' | 'json' = 'html';
	/** CSS length applied to `.ProseMirror { min-height }`. */
	@Input() minHeight = '320px';
	/** When set, the content area scrolls. */
	@Input() maxHeight: string | null = null;
	/** CharacterCount hard limit. Applied at instantiation. */
	@Input() characterLimit: number | null = null;
	/** Renders the chars/words footer row. */
	@Input() showCharacterCount = false;
	/** Extra class on the `.ProseMirror` host for per-site tweaks. */
	@Input() editorClass = '';
	/** Mirrors `setDisabledState` — either path makes content non-editable + toolbar inert. */
	@Input() set disabled(value: boolean) {
		this.setDisabledState(!!value);
	}
	get disabled(): boolean {
		return this.isDisabled;
	}

	/** After browser-side instantiation — escape hatch for programmatic control. */
	@Output() created = new EventEmitter<Editor>();
	/** Every doc-changing transaction; payload shape follows `outputFormat`. */
	@Output() changed = new EventEmitter<string | JSONContent>();
	/** Editor gained focus. */
	@Output() focused = new EventEmitter<void>();
	/** Editor lost focus (also triggers the CVA `onTouched`). */
	@Output() blurred = new EventEmitter<void>();

	@ViewChild('content', { static: true }) contentRef: ElementRef<HTMLDivElement>;

	/** Last-resort escape hatch (also emitted by `created`). */
	public editor: Editor | null = null;
	public toolbarGroups: ToolbarGroup[] = [];
	public toolbarOptions: PresetToolbarOptions = { marks: [], alignments: [] };
	public isDisabled = false;
	public isFocused = false;
	public characters = 0;
	public words = 0;
	public ssrPreviewHtml: string | null = null;

	/** Value written before the editor exists (SSR / early `writeValue`) — applied at instantiation. */
	private _pendingValue: string | JSONContent | null | undefined;
	private _hasPendingValue = false;
	/** A queued `setContent(value, true)` still owes the form its notification. */
	private _pendingEmitUpdate = false;
	/** Guard against write→update→write feedback loops when the form patches back the emitted value. */
	private _lastEmittedValue: string | JSONContent | null = null;
	private _destroyed = false;
	private _onChange: (value: string | JSONContent) => void = () => {};
	private _onTouched: () => void = () => {};
	private _touched = false;

	constructor(
		private readonly _zone: NgZone,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _sanitizer: DomSanitizer,
		@Inject(PLATFORM_ID) private readonly _platformId: object
	) {}

	get showCounter(): boolean {
		return this.showCharacterCount || this.characterLimit != null;
	}

	get counterStatus(): 'basic' | 'warning' | 'danger' {
		if (this.characterLimit == null) {
			return 'basic';
		}
		if (this.characters >= this.characterLimit) {
			return 'danger';
		}
		return this.characters >= this.characterLimit * 0.9 ? 'warning' : 'basic';
	}

	ngAfterViewInit(): void {
		// `new Editor(...)` requires a real DOM — instantiate only in the browser (§3.8).
		if (!isPlatformBrowser(this._platformId)) {
			return;
		}
		// Fire-and-forget by necessity (a lifecycle hook cannot be awaited), so the promise
		// has to be terminated here: `_createEditor` opens with dynamic `import()`s, which
		// reject on a chunk-load failure — routine when a deploy invalidates hashed chunk
		// names while a tab is open. Left floating that surfaced only as an unhandled
		// rejection and a permanently blank editor.
		void this._createEditor().catch((error) => {
			console.error('[RichTextEditor] Failed to initialize the editor', error);
			// Keep the SSR/preview markup (or the empty box) rather than a half-built view,
			// and let the host re-render.
			this._cdr.markForCheck();
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['placeholder'] && !changes['placeholder'].firstChange) {
			this._applyPlaceholder(this.placeholder ?? '');
		}
	}

	ngOnDestroy(): void {
		// Unconditional destroy — leaked ProseMirror views hold DOM references (§3.8).
		this._destroyed = true;
		this.editor?.destroy();
		this.editor = null;
	}

	// -------------------------------------------------------------------------
	// ControlValueAccessor
	// -------------------------------------------------------------------------

	writeValue(value: string | JSONContent | null | undefined): void {
		if (!this.editor) {
			this._pendingValue = value;
			this._hasPendingValue = true;
			// A form write is the source of truth already — applying it must not echo back.
			this._pendingEmitUpdate = false;
			if (
				!isPlatformBrowser(this._platformId) &&
				this.outputFormat === 'html' &&
				typeof value === 'string' &&
				value
			) {
				// SSR: non-interactive preview through Angular's sanitizer.
				this.ssrPreviewHtml = this._sanitizer.sanitize(SecurityContext.HTML, value);
			}
			return;
		}
		this._applyValue(value);
	}

	registerOnChange(fn: (value: string | JSONContent) => void): void {
		this._onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this._onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.isDisabled = isDisabled;
		this.editor?.setEditable(!isDisabled);
		this._cdr.markForCheck();
	}

	// -------------------------------------------------------------------------
	// Public programmatic API (05-editor-spec.md §3.7)
	// -------------------------------------------------------------------------

	/**
	 * Replaces the whole content. The mandated replacement for the one legacy
	 * imperative CKEditor call site: with `emitUpdate` left `true` the CVA emits
	 * and the bound form control stays in sync.
	 */
	setContent(value: string | JSONContent, emitUpdate = true): void {
		if (!this.editor) {
			// Called before instantiation (a seed from `ngOnInit`, or SSR): queue the
			// value *and* the caller's intent to emit — dropping the emit silently
			// applied the content while the bound control kept its old value.
			this._pendingValue = value;
			this._hasPendingValue = true;
			this._pendingEmitUpdate = emitUpdate;
			return;
		}
		const content = typeof value === 'string' ? normalizeLegacyHtml(value) : value;
		this.editor.commands.setContent(content, { emitUpdate });
	}

	/** Inserts content at the cursor. */
	insertContent(value: string | JSONContent): void {
		this.editor?.chain().focus().insertContent(value).run();
	}

	focus(position: 'start' | 'end' = 'end'): void {
		this.editor?.chain().focus(position).run();
	}

	getHTML(): string {
		return this.editor && !this.editor.isEmpty ? this.editor.getHTML() : '';
	}

	getJSON(): JSONContent | null {
		return this.editor ? (this.editor.getJSON() as JSONContent) : null;
	}

	getText(): string {
		return this.editor ? this.editor.getText() : '';
	}

	isEmpty(): boolean {
		return this.editor ? this.editor.isEmpty : true;
	}

	// -------------------------------------------------------------------------
	// Internals
	// -------------------------------------------------------------------------

	private async _createEditor(): Promise<void> {
		// Each preset is its own lazy chunk (§12); the Editor class rides along with it.
		const [{ Editor: TiptapEditor }, { createEditorExtensions }] = await Promise.all([
			import('@tiptap/core'),
			import('./presets')
		]);

		const options: RichTextEditorPresetOptions = {
			placeholder: this.placeholder ?? '',
			characterLimit: this.characterLimit
		};
		const definition = await createEditorExtensions(this.preset, options);

		if (this._destroyed) {
			return;
		}

		this.toolbarGroups = definition.toolbar;
		this.toolbarOptions = definition.toolbarOptions;

		// TipTap events fire outside Angular's zone; re-enter only to push state (§3.8).
		this._zone.runOutsideAngular(() => {
			this.editor = new TiptapEditor({
				element: this.contentRef.nativeElement,
				extensions: definition.extensions,
				editable: !this.isDisabled,
				editorProps: {
					attributes: {
						class: `rich-text-editor__prosemirror ${this.editorClass}`.trim(),
						role: 'textbox',
						'aria-multiline': 'true'
					}
				},
				onUpdate: ({ editor, transaction }) => {
					if (!transaction.docChanged) {
						return;
					}
					this._zone.run(() => this._handleUpdate(editor as Editor));
				},
				onFocus: () => {
					this._zone.run(() => {
						this.isFocused = true;
						this.focused.emit();
						this._cdr.markForCheck();
					});
				},
				onBlur: () => {
					this._zone.run(() => {
						this.isFocused = false;
						if (!this._touched) {
							this._touched = true;
						}
						this._onTouched();
						this.blurred.emit();
						this._cdr.markForCheck();
					});
				}
			});
		});

		if (this._hasPendingValue) {
			const emitUpdate = this._pendingEmitUpdate;
			this._applyValue(this._pendingValue);
			this._pendingValue = undefined;
			this._hasPendingValue = false;
			this._pendingEmitUpdate = false;
			// Honour the queued `setContent(value, true)`: the content was applied
			// with `emitUpdate: false`, so the CVA notification has to be issued here.
			if (emitUpdate && this.editor) {
				this._handleUpdate(this.editor);
			}
		}

		this._refreshCounts();
		this.ssrPreviewHtml = null;
		this.created.emit(this.editor as Editor);
		this._cdr.markForCheck();
	}

	private _applyValue(value: string | JSONContent | null | undefined): void {
		if (!this.editor) {
			return;
		}
		// Equality guard: skip the value the editor itself just emitted.
		if (value === this._lastEmittedValue && value !== null && value !== undefined) {
			return;
		}
		if (value === null || value === undefined || value === '') {
			this.editor.commands.clearContent(false);
		} else if (typeof value === 'string') {
			this.editor.commands.setContent(normalizeLegacyHtml(value), { emitUpdate: false });
		} else {
			this.editor.commands.setContent(value, { emitUpdate: false });
		}
		this._refreshCounts();
		this._cdr.markForCheck();
	}

	/**
	 * Serialize the editor's document into the value the CVA / `changed` output carries.
	 *
	 * Empty-document normalization: an empty doc emits '' — never '<p></p>' —
	 * so `Validators.required` on existing forms keeps working unchanged.
	 */
	private _serializeValue(editor: Editor): string | JSONContent {
		if (editor.isEmpty) {
			return '';
		}
		return this.outputFormat === 'json' ? (editor.getJSON() as JSONContent) : editor.getHTML();
	}

	private _handleUpdate(editor: Editor): void {
		const value: string | JSONContent = this._serializeValue(editor);

		this._lastEmittedValue = value;
		this._onChange(value);
		this.changed.emit(value);
		this._refreshCounts();
		this._cdr.markForCheck();
	}

	private _refreshCounts(): void {
		const storage = (this.editor?.storage as Record<string, any>)?.['characterCount'];
		if (storage) {
			this.characters = storage.characters();
			this.words = storage.words();
		}
	}

	private _applyPlaceholder(text: string): void {
		if (!this.editor) {
			return;
		}
		const extension = this.editor.extensionManager.extensions.find((ext) => ext.name === 'placeholder');
		if (extension) {
			// `options` is a read-only property on the extension, but the object it holds is the live
			// one the Placeholder plugin reads on every decoration pass — mutate it in place.
			Object.assign(extension.options, { placeholder: text });
			// Nudge a decoration re-render without touching the doc.
			this.editor.view.dispatch(this.editor.state.tr);
		}
	}
}
