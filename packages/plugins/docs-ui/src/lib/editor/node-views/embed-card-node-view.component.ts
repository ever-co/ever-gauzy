import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { AngularNodeViewComponent } from '../node-view/angular-node-view-renderer';

/**
 * Node view for `embedCard` (spec 05 §6.2): render-only bookmark card — generic
 * globe icon + domain (no external favicon fetch in v1), title (or URL) and an
 * open-in-new-tab affordance.
 */
@Component({
	selector: 'gz-embed-card-node-view',
	standalone: true,
	imports: [CommonModule, TranslateModule, NbIconModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="gz-embed-card" [class.selected]="selected()" tabindex="0" role="group">
			<nb-icon class="gz-embed-icon" icon="globe-outline"></nb-icon>
			<div class="gz-embed-meta">
				<span class="gz-embed-title">{{ title }}</span>
				<span class="gz-embed-domain">{{ domain }}</span>
				<span class="gz-embed-description" *ngIf="description">{{ description }}</span>
			</div>
			<a
				class="gz-embed-open"
				[href]="url"
				target="_blank"
				rel="noopener noreferrer nofollow"
				[attr.aria-label]="'DOCS.EDITOR.EMBED.OPEN' | translate"
			>
				<nb-icon icon="external-link-outline"></nb-icon>
			</a>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.gz-embed-card {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				margin: 0.375rem 0;
				padding: 0.625rem 0.75rem;
				border: 1px solid var(--border-basic-color-3);
				border-radius: var(--border-radius);
				background: var(--background-basic-color-1);
			}
			.gz-embed-card.selected {
				outline: 2px solid var(--color-primary-transparent-300);
			}
			.gz-embed-icon {
				font-size: 1.5rem;
				color: var(--text-hint-color);
			}
			.gz-embed-meta {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
			}
			.gz-embed-title {
				font-weight: 600;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.gz-embed-domain,
			.gz-embed-description {
				font-size: 0.75rem;
				color: var(--text-hint-color);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.gz-embed-open {
				color: var(--text-hint-color);
			}
		`
	]
})
export class EmbedCardNodeViewComponent extends AngularNodeViewComponent {
	get url(): string {
		return (this.node().attrs['url'] as string) || '';
	}

	get title(): string {
		return (this.node().attrs['title'] as string) || this.url;
	}

	get description(): string | null {
		return (this.node().attrs['description'] as string | null) ?? null;
	}

	get domain(): string {
		try {
			return new URL(this.url).hostname;
		} catch {
			return this.url;
		}
	}
}
