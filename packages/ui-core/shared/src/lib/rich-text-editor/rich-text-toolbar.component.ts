import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	Input,
	NgZone,
	OnDestroy
} from '@angular/core';
import type { Editor } from '@tiptap/core';
import { PresetToolbarOptions, ToolbarAlignment, ToolbarGroup, ToolbarMark } from './presets/preset.types';

type BlockFormat = 'paragraph' | 'h1' | 'h2' | 'h3';

interface FontStack {
	label: string;
	value: string;
}

/**
 * `ga-rich-text-toolbar` — internal toolbar of `ga-rich-text-editor`
 * (05-editor-spec.md §3.4). Button clusters are driven by the preset's
 * `ToolbarGroup[]`; individual buttons additionally gate on schema membership so
 * a cluster never renders a command its editor cannot execute. Active state is
 * re-read on every editor transaction (re-entered into Angular's zone).
 */
@Component({
	selector: 'ga-rich-text-toolbar',
	templateUrl: './rich-text-toolbar.component.html',
	styleUrls: ['./rich-text-toolbar.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class RichTextToolbarComponent implements OnDestroy {
	@Input() set editor(value: Editor | null) {
		this._detachFromEditor();
		this._editor = value;
		this._attachToEditor();
		this._updateState();
	}
	get editor(): Editor | null {
		return this._editor;
	}

	@Input() groups: ToolbarGroup[] = [];
	@Input() options: PresetToolbarOptions = { marks: [], alignments: [] };
	@Input() disabled = false;

	/** editor.isActive(...) snapshot, refreshed per transaction. */
	public active: Record<string, boolean> = {};
	public blockFormat: BlockFormat = 'paragraph';
	public currentFontFamily = '';
	public canUndo = false;
	public canRedo = false;

	/** Inline popovers (tier 1 keeps link/image/color as lightweight popovers — no NbDialog round-trip). */
	public linkFormOpen = false;
	public linkUrl = '';
	public imageFormOpen = false;
	public imageUrl = '';
	public textColorOpen = false;
	public highlightOpen = false;

	/** 12 text-color swatches from the Gauzy/Nebular palette. */
	public readonly textColors: string[] = [
		'#222b45',
		'#8f9bb3',
		'#ffffff',
		'#e74c3c',
		'#e67e22',
		'#f1c40f',
		'#27ae60',
		'#16a085',
		'#3366ff',
		'#0095ff',
		'#8e44ad',
		'#e84393'
	];

	/** 5 highlight swatches. */
	public readonly highlightColors: string[] = ['#fff3cd', '#d4edda', '#cce5ff', '#f8d7da', '#e2d9f3'];

	/** 6 font-stack presets (05-editor-spec.md §3.3). */
	public readonly fontFamilies: FontStack[] = [
		{ label: 'Sans Serif', value: 'Arial, Helvetica, sans-serif' },
		{ label: 'Serif', value: 'Georgia, serif' },
		{ label: 'Times', value: '"Times New Roman", Times, serif' },
		{ label: 'Monospace', value: '"Courier New", Courier, monospace' },
		{ label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
		{ label: 'Trebuchet', value: '"Trebuchet MS", Helvetica, sans-serif' }
	];

	private _editor: Editor | null = null;
	private readonly _transactionHandler = (): void => {
		this._zone.run(() => this._updateState());
	};

	constructor(private readonly _zone: NgZone, private readonly _cdr: ChangeDetectorRef) {}

	ngOnDestroy(): void {
		this._detachFromEditor();
	}

	// -------------------------------------------------------------------------
	// Template helpers
	// -------------------------------------------------------------------------

	/** Whether the preset renders a toolbar cluster. */
	inGroup(group: ToolbarGroup): boolean {
		return this.groups.includes(group);
	}

	/** Whether the preset offers a basic mark button. */
	hasMarkButton(mark: ToolbarMark): boolean {
		return this.options.marks.includes(mark);
	}

	hasAlignment(alignment: ToolbarAlignment): boolean {
		return this.options.alignments.includes(alignment);
	}

	/** Schema-membership gates: never render a command the schema cannot execute. */
	hasNode(name: string): boolean {
		return !!this._editor?.schema.nodes[name];
	}

	hasMark(name: string): boolean {
		return !!this._editor?.schema.marks[name];
	}

	// -------------------------------------------------------------------------
	// Commands
	// -------------------------------------------------------------------------

	/**
	 * Runs a chained editor command by name (`toggleBold`, `undo`, `addRowAfter`, …).
	 * The cast is contained here: command names come from the fixed template, but the
	 * chain type only knows commands of statically-registered extensions.
	 */
	run(command: string, attributes?: Record<string, unknown>): void {
		if (!this._editor || this.disabled) {
			return;
		}
		const chain = this._editor.chain().focus() as unknown as Record<
			string,
			(attrs?: Record<string, unknown>) => { run: () => void }
		>;
		chain[command]?.(attributes)?.run?.();
	}

	setBlockFormat(format: BlockFormat): void {
		if (!this._editor || this.disabled) {
			return;
		}
		const chain = this._editor.chain().focus();
		if (format === 'paragraph') {
			chain.setParagraph().run();
		} else {
			chain.setHeading({ level: Number(format.substring(1)) as 1 | 2 | 3 }).run();
		}
	}

	setAlignment(alignment: ToolbarAlignment): void {
		this._editor?.chain().focus().setTextAlign(alignment).run();
	}

	setFontFamily(fontFamily: string): void {
		if (!this._editor) {
			return;
		}
		if (fontFamily) {
			this._editor.chain().focus().setFontFamily(fontFamily).run();
		} else {
			this._editor.chain().focus().unsetFontFamily().run();
		}
	}

	setTextColor(color: string | null): void {
		if (!this._editor) {
			return;
		}
		if (color) {
			this._editor.chain().focus().setColor(color).run();
		} else {
			this._editor.chain().focus().unsetColor().run();
		}
		this.textColorOpen = false;
	}

	setHighlight(color: string | null): void {
		if (!this._editor) {
			return;
		}
		if (color) {
			this._editor.chain().focus().toggleHighlight({ color }).run();
		} else {
			this._editor.chain().focus().unsetHighlight().run();
		}
		this.highlightOpen = false;
	}

	clearFormatting(): void {
		this._editor?.chain().focus().clearNodes().unsetAllMarks().run();
	}

	insertTable(): void {
		this._editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
	}

	// ── Link popover ─────────────────────────────────────────────────────────

	toggleLinkForm(): void {
		if (this.disabled) {
			return;
		}
		this.linkFormOpen = !this.linkFormOpen;
		this.imageFormOpen = this.textColorOpen = this.highlightOpen = false;
		if (this.linkFormOpen) {
			this.linkUrl = (this._editor?.getAttributes('link') as { href?: string })?.href ?? '';
		}
	}

	applyLink(): void {
		const url = (this.linkUrl || '').trim();
		if (!this._editor) {
			return;
		}
		if (url) {
			this._editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		} else {
			this.removeLink();
			return;
		}
		this.linkFormOpen = false;
	}

	removeLink(): void {
		this._editor?.chain().focus().extendMarkRange('link').unsetLink().run();
		this.linkFormOpen = false;
	}

	// ── Image popover (URL dialog — render-only image support, tier 1) ───────

	toggleImageForm(): void {
		if (this.disabled) {
			return;
		}
		this.imageFormOpen = !this.imageFormOpen;
		this.linkFormOpen = this.textColorOpen = this.highlightOpen = false;
		this.imageUrl = '';
	}

	applyImage(): void {
		const url = (this.imageUrl || '').trim();
		if (url && this._editor) {
			this._editor.chain().focus().setImage({ src: url }).run();
		}
		this.imageFormOpen = false;
	}

	toggleTextColorPanel(): void {
		this.textColorOpen = !this.textColorOpen;
		this.highlightOpen = this.linkFormOpen = this.imageFormOpen = false;
	}

	toggleHighlightPanel(): void {
		this.highlightOpen = !this.highlightOpen;
		this.textColorOpen = this.linkFormOpen = this.imageFormOpen = false;
	}

	// -------------------------------------------------------------------------
	// State tracking
	// -------------------------------------------------------------------------

	private _attachToEditor(): void {
		// 'transaction' covers doc changes AND selection moves — active state stays fresh.
		this._editor?.on('transaction', this._transactionHandler);
	}

	private _detachFromEditor(): void {
		this._editor?.off('transaction', this._transactionHandler);
	}

	private _updateState(): void {
		const editor = this._editor;
		if (!editor) {
			return;
		}
		this.active = {
			bold: editor.isActive('bold'),
			italic: editor.isActive('italic'),
			underline: editor.isActive('underline'),
			strike: editor.isActive('strike'),
			code: editor.isActive('code'),
			codeBlock: editor.isActive('codeBlock'),
			subscript: editor.isActive('subscript'),
			superscript: editor.isActive('superscript'),
			highlight: editor.isActive('highlight'),
			bulletList: editor.isActive('bulletList'),
			orderedList: editor.isActive('orderedList'),
			taskList: editor.isActive('taskList'),
			blockquote: editor.isActive('blockquote'),
			link: editor.isActive('link'),
			table: editor.isActive('table'),
			alignLeft: editor.isActive({ textAlign: 'left' }),
			alignCenter: editor.isActive({ textAlign: 'center' }),
			alignRight: editor.isActive({ textAlign: 'right' }),
			alignJustify: editor.isActive({ textAlign: 'justify' })
		};
		this.blockFormat = editor.isActive('heading', { level: 1 })
			? 'h1'
			: editor.isActive('heading', { level: 2 })
			? 'h2'
			: editor.isActive('heading', { level: 3 })
			? 'h3'
			: 'paragraph';
		this.currentFontFamily = (editor.getAttributes('textStyle') as { fontFamily?: string })?.fontFamily ?? '';
		this.canUndo = editor.can().undo();
		this.canRedo = editor.can().redo();
		this._cdr.markForCheck();
	}
}
