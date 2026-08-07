import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	Input,
	OnDestroy,
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
export class FloatingBlockMenuComponent implements AfterViewInit, OnDestroy {
	@Input({ required: true }) editor!: Editor;

	@ViewChild('menu', { static: true }) menuRef!: ElementRef<HTMLElement>;

	ngAfterViewInit(): void {
		this.editor.registerPlugin(
			FloatingMenuPlugin({
				pluginKey,
				editor: this.editor,
				element: this.menuRef.nativeElement,
				options: { placement: 'left', offset: 8 },
				shouldShow: ({ editor, state }) => {
					if (!editor.isEditable) return false;
					const { $anchor, empty } = state.selection;
					const isEmptyParagraph =
						$anchor.parent.type.name === 'paragraph' && $anchor.parent.content.size === 0;
					return empty && isEmptyParagraph;
				}
			} as never)
		);
	}

	ngOnDestroy(): void {
		this.editor.unregisterPlugin(pluginKey);
	}

	openSlashMenu(): void {
		this.editor.chain().focus().insertContent('/').run();
	}
}
