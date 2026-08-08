import { CommonModule } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { NodeSelection, PluginKey } from '@tiptap/pm/state';
import { SuggestionHostService } from '../suggestion/suggestion-host.service';

const pluginKey = new PluginKey('gzTextBubbleMenu');

/** 12 text-color swatches + reset (spec 05 §5 TextStyleKit). */
export const TEXT_COLORS = [
	'#0f172a',
	'#64748b',
	'#dc2626',
	'#ea580c',
	'#d97706',
	'#65a30d',
	'#16a34a',
	'#0d9488',
	'#0284c7',
	'#4f46e5',
	'#9333ea',
	'#db2777'
];

/** 5 highlight swatches from the Gauzy palette (spec 05 §5 Highlight). */
export const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];

type TurnInto =
	| 'paragraph'
	| 'heading1'
	| 'heading2'
	| 'heading3'
	| 'bulletList'
	| 'orderedList'
	| 'blockquote'
	| 'callout';

/**
 * Selection bubble menu (spec 05 §6.5): marks, link, highlight, text color and
 * a "turn into" dropdown. Suppressed inside code blocks, on node selections and
 * while a suggestion popup is open.
 */
@Component({
	selector: 'gz-text-bubble-menu',
	standalone: true,
	imports: [CommonModule, FormsModule, TranslateModule, NbButtonModule, NbIconModule, NbInputModule, NbTooltipModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="gz-bubble-menu" #menu>
			<ng-container *ngIf="!linkEditing; else linkEditor">
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="isActive('bold')"
					[attr.aria-pressed]="isActive('bold')"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.BOLD' | translate"
					(click)="run('toggleBold')"
				>
					<i class="fas fa-bold"></i>
				</button>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="isActive('italic')"
					[attr.aria-pressed]="isActive('italic')"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.ITALIC' | translate"
					(click)="run('toggleItalic')"
				>
					<i class="fas fa-italic"></i>
				</button>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="isActive('underline')"
					[attr.aria-pressed]="isActive('underline')"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.UNDERLINE' | translate"
					(click)="run('toggleUnderline')"
				>
					<i class="fas fa-underline"></i>
				</button>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="isActive('strike')"
					[attr.aria-pressed]="isActive('strike')"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.STRIKE' | translate"
					(click)="run('toggleStrike')"
				>
					<i class="fas fa-strikethrough"></i>
				</button>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="isActive('code')"
					[attr.aria-pressed]="isActive('code')"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.CODE' | translate"
					(click)="run('toggleCode')"
				>
					<nb-icon icon="code-outline"></nb-icon>
				</button>
				<span class="gz-bubble-divider"></span>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="isActive('link')"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.LINK' | translate"
					(click)="startLinkEdit()"
				>
					<nb-icon icon="link-2-outline"></nb-icon>
				</button>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="highlightOpen"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.HIGHLIGHT' | translate"
					(click)="highlightOpen = !highlightOpen; colorOpen = false; turnIntoOpen = false"
				>
					<i class="fas fa-highlighter"></i>
				</button>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					[class.active]="colorOpen"
					[nbTooltip]="'DOCS.EDITOR.FORMAT.TEXT_COLOR' | translate"
					(click)="colorOpen = !colorOpen; highlightOpen = false; turnIntoOpen = false"
				>
					<i class="fas fa-font"></i>
				</button>
				<span class="gz-bubble-divider"></span>
				<button
					nbButton
					ghost
					size="tiny"
					type="button"
					class="gz-turn-into"
					[class.active]="turnIntoOpen"
					(click)="turnIntoOpen = !turnIntoOpen; colorOpen = false; highlightOpen = false"
				>
					{{ 'DOCS.EDITOR.FORMAT.TURN_INTO' | translate }}
					<nb-icon icon="chevron-down-outline"></nb-icon>
				</button>
			</ng-container>

			<ng-template #linkEditor>
				<input
					nbInput
					fieldSize="tiny"
					type="url"
					class="gz-link-input"
					[placeholder]="'DOCS.EDITOR.FORMAT.LINK_PLACEHOLDER' | translate"
					[(ngModel)]="linkUrl"
					(keydown.enter)="applyLink()"
					(keydown.escape)="linkEditing = false"
				/>
				<button nbButton ghost size="tiny" status="primary" type="button" (click)="applyLink()">
					{{ 'DOCS.EDITOR.FORMAT.LINK_APPLY' | translate }}
				</button>
				<button nbButton ghost size="tiny" status="danger" type="button" (click)="removeLink()">
					{{ 'DOCS.EDITOR.FORMAT.UNLINK' | translate }}
				</button>
			</ng-template>

			<div class="gz-bubble-panel" *ngIf="highlightOpen">
				<button
					*ngFor="let color of highlightColors"
					type="button"
					class="gz-swatch"
					[style.background]="color"
					(click)="setHighlight(color)"
				></button>
				<button type="button" class="gz-swatch gz-swatch-clear" (click)="setHighlight(null)">×</button>
			</div>
			<div class="gz-bubble-panel" *ngIf="colorOpen">
				<button
					*ngFor="let color of textColors"
					type="button"
					class="gz-swatch"
					[style.background]="color"
					(click)="setColor(color)"
				></button>
				<button type="button" class="gz-swatch gz-swatch-clear" (click)="setColor(null)">×</button>
			</div>
			<div class="gz-bubble-panel gz-turn-into-panel" *ngIf="turnIntoOpen">
				<button type="button" (click)="turnInto('paragraph')">{{ 'DOCS.EDITOR.SLASH.TEXT' | translate }}</button>
				<button type="button" (click)="turnInto('heading1')">{{ 'DOCS.EDITOR.SLASH.HEADING_1' | translate }}</button>
				<button type="button" (click)="turnInto('heading2')">{{ 'DOCS.EDITOR.SLASH.HEADING_2' | translate }}</button>
				<button type="button" (click)="turnInto('heading3')">{{ 'DOCS.EDITOR.SLASH.HEADING_3' | translate }}</button>
				<button type="button" (click)="turnInto('bulletList')">
					{{ 'DOCS.EDITOR.SLASH.BULLET_LIST' | translate }}
				</button>
				<button type="button" (click)="turnInto('orderedList')">
					{{ 'DOCS.EDITOR.SLASH.ORDERED_LIST' | translate }}
				</button>
				<button type="button" (click)="turnInto('blockquote')">{{ 'DOCS.EDITOR.SLASH.QUOTE' | translate }}</button>
				<button type="button" (click)="turnInto('callout')">
					{{ 'DOCS.EDITOR.SLASH.CALLOUT_INFO' | translate }}
				</button>
			</div>
		</div>
	`,
	styles: [
		`
			.gz-bubble-menu {
				position: relative;
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
			.gz-bubble-menu button.active {
				background: var(--color-primary-transparent-100);
			}
			.gz-bubble-divider {
				width: 1px;
				align-self: stretch;
				background: var(--border-basic-color-3);
				margin: 0 0.125rem;
			}
			.gz-link-input {
				width: 14rem;
			}
			.gz-bubble-panel {
				position: absolute;
				top: calc(100% + 0.25rem);
				left: 0;
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				padding: 0.375rem;
				border-radius: var(--border-radius);
				border: 1px solid var(--border-basic-color-3);
				background: var(--background-basic-color-1);
				box-shadow: var(--shadow);
				z-index: 10;
			}
			.gz-swatch {
				width: 1.25rem;
				height: 1.25rem;
				border-radius: 0.25rem;
				border: 1px solid var(--border-basic-color-3);
				cursor: pointer;
				padding: 0;
			}
			.gz-swatch-clear {
				background: transparent;
				color: var(--text-hint-color);
			}
			.gz-turn-into-panel {
				flex-direction: column;
				min-width: 10rem;
			}
			.gz-turn-into-panel button {
				border: none;
				background: transparent;
				text-align: left;
				padding: 0.25rem 0.5rem;
				border-radius: 0.25rem;
				cursor: pointer;
				color: var(--text-basic-color);
			}
			.gz-turn-into-panel button:hover {
				background: var(--background-basic-color-2);
			}
		`
	]
})
export class TextBubbleMenuComponent implements AfterViewInit, OnChanges, OnDestroy {
	@Input({ required: true }) editor!: Editor;

	@ViewChild('menu', { static: true }) menuRef!: ElementRef<HTMLElement>;

	private readonly suggestionHost = inject(SuggestionHostService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly zone = inject(NgZone);

	public readonly textColors = TEXT_COLORS;
	public readonly highlightColors = HIGHLIGHT_COLORS;
	public linkEditing = false;
	public linkUrl = '';
	public highlightOpen = false;
	public colorOpen = false;
	public turnIntoOpen = false;

	private readonly onTransaction = () => this.zone.run(() => this.cdr.markForCheck());

	/**
	 * The `Editor` this component's ProseMirror plugin and listeners are currently
	 * registered against — deliberately *not* read back off `this.editor`, which the
	 * parent re-points before the teardown of the previous registration can run.
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
	 * menu stays bound to a destroyed editor and every button silently does nothing
	 * after switching documents (spec 05 §9.2).
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
				options: { placement: 'top-start', offset: 8 },
				shouldShow: ({ editor: active, state }) => {
					if (!active.isEditable || state.selection.empty) return false;
					if (state.selection instanceof NodeSelection) return false;
					if (active.isActive('codeBlock')) return false;
					if (this.suggestionHost.isOpen) return false;
					return true;
				}
			} as never)
		);
		editor.on('transaction', this.onTransaction);
		editor.on('selectionUpdate', this.closePanels);
		this.attached = editor;
	}

	private detach(): void {
		const editor = this.attached;
		if (!editor) return;
		this.attached = null;
		editor.off('transaction', this.onTransaction);
		editor.off('selectionUpdate', this.closePanels);
		// A rebuild destroys the previous editor before this runs; its ProseMirror view
		// (and with it the plugin) is already gone, and `unregisterPlugin` would only
		// reconfigure a dead state.
		if (!editor.isDestroyed) editor.unregisterPlugin(pluginKey);
	}

	isActive(name: string): boolean {
		return this.editor?.isActive(name) ?? false;
	}

	run(command: 'toggleBold' | 'toggleItalic' | 'toggleUnderline' | 'toggleStrike' | 'toggleCode'): void {
		const chain = this.editor.chain().focus();
		(chain[command] as () => typeof chain)().run();
	}

	startLinkEdit(): void {
		this.linkUrl = (this.editor.getAttributes('link')['href'] as string) ?? '';
		this.linkEditing = true;
	}

	applyLink(): void {
		const url = this.linkUrl.trim();
		if (url) {
			this.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		}
		this.linkEditing = false;
	}

	removeLink(): void {
		this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
		this.linkEditing = false;
	}

	setHighlight(color: string | null): void {
		if (color) this.editor.chain().focus().setHighlight({ color }).run();
		else this.editor.chain().focus().unsetHighlight().run();
		this.highlightOpen = false;
	}

	setColor(color: string | null): void {
		if (color) this.editor.chain().focus().setColor(color).run();
		else this.editor.chain().focus().unsetColor().run();
		this.colorOpen = false;
	}

	turnInto(target: TurnInto): void {
		const chain = this.editor.chain().focus();
		switch (target) {
			case 'paragraph':
				chain.setParagraph().run();
				break;
			case 'heading1':
				chain.setHeading({ level: 1 }).run();
				break;
			case 'heading2':
				chain.setHeading({ level: 2 }).run();
				break;
			case 'heading3':
				chain.setHeading({ level: 3 }).run();
				break;
			case 'bulletList':
				chain.toggleBulletList().run();
				break;
			case 'orderedList':
				chain.toggleOrderedList().run();
				break;
			case 'blockquote':
				chain.setBlockquote().run();
				break;
			case 'callout':
				chain.setCallout({ type: 'info' }).run();
				break;
		}
		this.turnIntoOpen = false;
	}

	private readonly closePanels = () =>
		this.zone.run(() => {
			this.highlightOpen = false;
			this.colorOpen = false;
			this.turnIntoOpen = false;
			this.linkEditing = false;
			this.cdr.markForCheck();
		});
}
