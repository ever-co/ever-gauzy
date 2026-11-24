import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { DocsTreeDrawerService } from '../../services/docs-tree-drawer.service';

/**
 * Opens the folder drawer: a bordered "Folders" button (icon + label, icon-only
 * on phones). Placed in each Documents page's own header, just before its
 * title, so the folder tree is one click away without a rail column taking
 * width from every page.
 *
 * Standalone so the lazily-loaded page editor can import it as well as the
 * plugin module.
 */
@Component({
	selector: 'gz-docs-folders-button',
	standalone: true,
	imports: [AsyncPipe, NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe],
	template: `
		<button
			nbButton
			ghost
			size="small"
			type="button"
			class="docs-folders-button"
			aria-controls="docs-tree-drawer"
			[attr.aria-expanded]="(drawer.open$ | async) === true"
			[attr.aria-label]="'DOCS.TREE.SHOW_FOLDERS' | translate"
			[nbTooltip]="'DOCS.TREE.SHOW_FOLDERS' | translate"
			(click)="drawer.toggle()"
		>
			<nb-icon icon="folder-outline"></nb-icon>
			<span class="docs-folders-button-label">{{ 'DOCS.TREE.FOLDERS' | translate }}</span>
		</button>
	`,
	styles: [
		`
			:host {
				display: inline-flex;
				flex: 0 0 auto;
			}
			/* A bordered button with a text label, so it reads as a control at a
			   glance (an icon alone next to the title looked like decoration). */
			.docs-folders-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				gap: 0.375rem;
				height: 1.875rem;
				padding: 0 0.625rem !important;
				border: 1px dashed var(--border-basic-color-4) !important;
				border-radius: var(--docs-radius, 0.375rem);
				color: var(--docs-text, var(--text-basic-color));
				font-size: 0.75rem;
				font-weight: 500;
				white-space: nowrap;
			}
			.docs-folders-button:hover,
			.docs-folders-button[aria-expanded='true'] {
				background: var(--docs-hover, rgba(126, 126, 143, 0.12));
			}
			.docs-folders-button nb-icon {
				margin: 0;
				font-size: 1rem;
				color: var(--docs-text-muted, var(--text-hint-color));
			}
			/* Phones: icon only, so the title keeps its room. */
			@media (max-width: 575px) {
				.docs-folders-button {
					width: 1.875rem;
					padding: 0 !important;
				}
				.docs-folders-button-label {
					display: none;
				}
			}
		`
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocsFoldersButtonComponent {
	constructor(public readonly drawer: DocsTreeDrawerService) {}
}
