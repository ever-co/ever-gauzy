import { Component, Input } from '@angular/core';
import { NbMenuItem } from '@nebular/theme';
import { IDocument } from '@gauzy/contracts';

/**
 * Actions column renderer (`01-ux-spec.md` §4.1, column 9): a kebab opening the
 * same action set as the tree context menu, plus Details and (for a FILE)
 * Preview.
 *
 * The cell renders only — the items are built by `DocsTableComponent` from the
 * shared `buildDocsActionMenu()`, and clicks come back through the table's own
 * `NbMenuService` subscription (one subscription for the page, keyed by the tag
 * prefix, rather than one per rendered row).
 */
@Component({
	selector: 'gz-docs-row-actions',
	template: `
		<button
			*ngIf="menuItems?.length"
			nbButton
			ghost
			size="tiny"
			type="button"
			class="docs-row-actions"
			[nbContextMenu]="menuItems"
			[nbContextMenuTag]="tag"
			(click)="$event.stopPropagation()"
			[attr.aria-label]="'DOCS.A11Y.NODE_ACTIONS' | translate"
		>
			<nb-icon icon="more-horizontal-outline" size="tiny"></nb-icon>
		</button>
	`,
	styles: [
		`
			.docs-row-actions {
				padding: 0.125rem 0.25rem;
			}
		`
	],
	standalone: false
})
export class RowActionsComponent {
	@Input() rowData: IDocument;
	/** Prebuilt, permission-filtered items (see `docs-action-menu.ts`). */
	@Input() menuItems: NbMenuItem[] = [];
	/** `<prefix><documentId>` — the table resolves the row from it. */
	@Input() tag = '';
}
