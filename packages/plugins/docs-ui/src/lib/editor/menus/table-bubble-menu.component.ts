import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	Input,
	NgZone,
	OnChanges,
	OnDestroy,
	SimpleChanges,
	ViewChild,
	inject
} from '@angular/core';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { PluginKey } from '@tiptap/pm/state';

const pluginKey = new PluginKey('gzTableBubbleMenu');

/**
 * Table chrome (spec 05 §6.7 — must-build): the free table extensions provide
 * model + commands but no UI. Bubble menu anchored above the active table with
 * row/column ops, header toggles, merge/split (enabled via `can()`), and
 * delete-table (undoable, no confirm).
 */
@Component({
	selector: 'gz-table-bubble-menu',
	standalone: true,
	imports: [TranslateModule, NbButtonModule, NbIconModule, NbTooltipModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="gz-bubble-menu gz-table-menu" #menu>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.ROW_ADD_ABOVE' | translate" (click)="exec('addRowBefore')">
				<nb-icon icon="arrow-upward-outline"></nb-icon>
			</button>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.ROW_ADD_BELOW' | translate" (click)="exec('addRowAfter')">
				<nb-icon icon="arrow-downward-outline"></nb-icon>
			</button>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.ROW_DELETE' | translate" (click)="exec('deleteRow')">
				<i class="fas fa-minus"></i>
				<nb-icon icon="menu-outline"></nb-icon>
			</button>
			<span class="gz-bubble-divider"></span>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.COL_ADD_LEFT' | translate" (click)="exec('addColumnBefore')">
				<nb-icon icon="arrow-back-outline"></nb-icon>
			</button>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.COL_ADD_RIGHT' | translate" (click)="exec('addColumnAfter')">
				<nb-icon icon="arrow-forward-outline"></nb-icon>
			</button>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.COL_DELETE' | translate" (click)="exec('deleteColumn')">
				<i class="fas fa-minus"></i>
				<nb-icon icon="more-vertical-outline"></nb-icon>
			</button>
			<span class="gz-bubble-divider"></span>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.HEADER_ROW' | translate" (click)="exec('toggleHeaderRow')">
				<i class="fas fa-heading"></i>
			</button>
			<button nbButton ghost size="tiny" type="button" [nbTooltip]="'DOCS.EDITOR.TABLE.HEADER_COL' | translate" (click)="exec('toggleHeaderColumn')">
				<i class="fas fa-heading fa-rotate-90"></i>
			</button>
			<span class="gz-bubble-divider"></span>
			<button
				nbButton
				ghost
				size="tiny"
				type="button"
				[disabled]="!canMerge"
				[nbTooltip]="'DOCS.EDITOR.TABLE.MERGE' | translate"
				(click)="exec('mergeCells')"
			>
				<i class="fas fa-object-group"></i>
			</button>
			<button
				nbButton
				ghost
				size="tiny"
				type="button"
				[disabled]="!canSplit"
				[nbTooltip]="'DOCS.EDITOR.TABLE.SPLIT' | translate"
				(click)="exec('splitCell')"
			>
				<i class="fas fa-object-ungroup"></i>
			</button>
			<span class="gz-bubble-divider"></span>
			<button
				nbButton
				ghost
				size="tiny"
				status="danger"
				type="button"
				[nbTooltip]="'DOCS.EDITOR.TABLE.DELETE' | translate"
				(click)="exec('deleteTable')"
			>
				<nb-icon icon="trash-2-outline"></nb-icon>
			</button>
		</div>
	`,
	styles: [
		`
			.gz-bubble-menu {
				display: flex;
				align-items: center;
				gap: 0.125rem;
				padding: 0.25rem;
				border-radius: var(--border-radius);
				border: 1px solid var(--border-basic-color-3);
				background: var(--background-basic-color-1);
				box-shadow: var(--shadow);
				visibility: hidden;
			}
			.gz-bubble-divider {
				width: 1px;
				align-self: stretch;
				background: var(--border-basic-color-3);
				margin: 0 0.125rem;
			}
		`
	]
})
export class TableBubbleMenuComponent implements AfterViewInit, OnChanges, OnDestroy {
	@Input({ required: true }) editor!: Editor;

	@ViewChild('menu', { static: true }) menuRef!: ElementRef<HTMLElement>;

	private readonly cdr = inject(ChangeDetectorRef);
	private readonly zone = inject(NgZone);

	private readonly onTransaction = () => this.zone.run(() => this.cdr.markForCheck());

	/**
	 * The `Editor` this component's ProseMirror plugin and listener are currently
	 * registered against — deliberately *not* read back off `this.editor`, which the
	 * parent re-points before the teardown of the previous registration can run.
	 */
	private attached: Editor | null = null;

	get canMerge(): boolean {
		return this.editor?.can().mergeCells() ?? false;
	}

	get canSplit(): boolean {
		return this.editor?.can().splitCell() ?? false;
	}

	ngAfterViewInit(): void {
		this.attach();
	}

	/**
	 * `DocumentEditorComponent.rebuildEditor()` (route `page/:id` change) destroys the
	 * old `Editor` and builds the replacement **synchronously**, so the `*ngIf="editor"`
	 * wrapping this component never goes falsy and this view is never torn down and
	 * recreated — only the `[editor]` binding changes. Without re-registering here the
	 * table chrome stays bound to a destroyed editor and never appears again after
	 * switching documents (spec 05 §6.7).
	 */
	ngOnChanges(changes: SimpleChanges): void {
		const change = changes['editor'];
		// The very first binding is registered by `ngAfterViewInit` instead: `ngOnChanges`
		// runs before `ngOnInit`, where the static view query for the menu element is
		// not guaranteed to be resolved yet.
		if (!change || change.firstChange) return;
		this.detach();
		this.attach();
	}

	ngOnDestroy(): void {
		this.detach();
	}

	private attach(): void {
		const editor = this.editor;
		if (!editor || this.attached === editor) return;
		editor.registerPlugin(
			BubbleMenuPlugin({
				pluginKey,
				editor,
				element: this.menuRef.nativeElement,
				updateDelay: 150,
				options: { placement: 'top', offset: 10 },
				shouldShow: ({ editor: active }) => active.isEditable && active.isActive('table')
			} as never)
		);
		editor.on('transaction', this.onTransaction);
		this.attached = editor;
	}

	private detach(): void {
		const editor = this.attached;
		if (!editor) return;
		this.attached = null;
		editor.off('transaction', this.onTransaction);
		// A rebuild destroys the previous editor before this runs; its ProseMirror view
		// (and with it the plugin) is already gone.
		if (!editor.isDestroyed) editor.unregisterPlugin(pluginKey);
	}

	exec(
		command:
			| 'addRowBefore'
			| 'addRowAfter'
			| 'deleteRow'
			| 'addColumnBefore'
			| 'addColumnAfter'
			| 'deleteColumn'
			| 'toggleHeaderRow'
			| 'toggleHeaderColumn'
			| 'mergeCells'
			| 'splitCell'
			| 'deleteTable'
	): void {
		const chain = this.editor.chain().focus();
		(chain[command] as () => typeof chain)().run();
	}
}
