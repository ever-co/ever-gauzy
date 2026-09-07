import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	Input,
	OnChanges,
	OnDestroy,
	SimpleChanges,
	ViewChild
} from '@angular/core';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Editor } from '@tiptap/core';
import { FloatingMenuPlugin } from '@tiptap/extension-floating-menu';
import { PluginKey } from '@tiptap/pm/state';

const pluginKey = new PluginKey('gzFloatingBlockMenu');

/**
 * Empty-line "+" menu (spec 05 §6.5): a ghost plus button on empty paragraphs;
 * clicking it opens the slash menu programmatically at that block (inserts `/`).
 */
@Component({
	selector: 'gz-floating-block-menu',
	standalone: true,
	imports: [TranslateModule, NbButtonModule, NbIconModule, NbTooltipModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="gz-floating-menu" #menu>
			<button
				nbButton
				ghost
				size="tiny"
				type="button"
				class="gz-plus-button"
				[nbTooltip]="'DOCS.EDITOR.ADD_BLOCK' | translate"
				(click)="openSlashMenu()"
			>
				<nb-icon icon="plus-outline"></nb-icon>
			</button>
		</div>
	`,
	styles: [
		`
			.gz-floating-menu {
				visibility: hidden;
			}
			.gz-plus-button {
				opacity: 0.5;
			}
			.gz-plus-button:hover {
				opacity: 1;
			}
		`
	]
})
export class FloatingBlockMenuComponent implements AfterViewInit, OnChanges, OnDestroy {
	@Input({ required: true }) editor!: Editor;

	@ViewChild('menu', { static: true }) menuRef!: ElementRef<HTMLElement>;

	/**
	 * The `Editor` this component's ProseMirror plugin is currently registered against
	 * — deliberately *not* read back off `this.editor`, which the parent re-points
	 * before the teardown of the previous registration can run.
	 */
	private attached: Editor | null = null;

	ngAfterViewInit(): void {
		this.attach();
	}

	/**
	 * `DocumentEditorComponent.rebuildEditor()` (route `page/:id` change) destroys the
	 * old `Editor` and builds the replacement **synchronously**, so the `*ngIf="editor"`
	 * wrapping this component never goes falsy and this view is never torn down and
	 * recreated — only the `[editor]` binding changes. Without re-registering here the
	 * empty-line "+" never appears again after switching documents (spec 05 §6.5).
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
			FloatingMenuPlugin({
				pluginKey,
				editor,
				element: this.menuRef.nativeElement,
				options: { placement: 'left', offset: 8 },
				shouldShow: ({ editor: active, state }) => {
					if (!active.isEditable) return false;
					const { $anchor, empty } = state.selection;
					const isEmptyParagraph =
						$anchor.parent.type.name === 'paragraph' && $anchor.parent.content.size === 0;
					return empty && isEmptyParagraph;
				}
			} as never)
		);
		this.attached = editor;
	}

	private detach(): void {
		const editor = this.attached;
		if (!editor) return;
		this.attached = null;
		// A rebuild destroys the previous editor before this runs; its ProseMirror view
		// (and with it the plugin) is already gone.
		if (!editor.isDestroyed) editor.unregisterPlugin(pluginKey);
	}

	openSlashMenu(): void {
		this.editor.chain().focus().insertContent('/').run();
	}
}
