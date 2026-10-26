import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Shows a report: pretty-printed for reading, with the size and, for a sent report, when it was sent
 * and the HTTP status. The formatted text is parsed from the exact stored bytes; the byte count is
 * theirs, and *Show the exact bytes* shows them unchanged (to copy them and check the signature).
 */
@Component({
	selector: 'ngx-ever-stats-payload-viewer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, TranslatePipe],
	template: `
		<dl class="meta">
			<dt>{{ 'EVER_STATS.BYTES' | translate }}</dt>
			<dd data-test="bytes">{{ bytes }}</dd>
			@if (sentAt) {
				<dt>{{ 'EVER_STATS.SENT_AT' | translate }}</dt>
				<dd data-test="sent-at">{{ sentAt | date: 'medium' }}</dd>
			}
			@if (httpStatus !== null && httpStatus !== undefined) {
				<dt>{{ 'EVER_STATS.HTTP_STATUS' | translate }}</dt>
				<dd data-test="http-status">{{ httpStatus }}</dd>
			}
		</dl>
		<pre data-test="payload">{{ raw ? payload : pretty }}</pre>
		<button type="button" class="toggle" data-test="raw-toggle" (click)="raw = !raw">
			{{ (raw ? 'EVER_STATS.SHOW_FORMATTED' : 'EVER_STATS.SHOW_RAW') | translate }}
		</button>
	`,
	styles: [
		`
			/* Same scale as the settings page around it: 12px meta, a hairline code well. */
			.meta {
				display: grid;
				grid-template-columns: max-content auto;
				gap: 0.25rem 0.75rem;
				margin: 0 0 0.5rem;
				font-size: 0.75rem;
				line-height: 1.125rem;
			}
			.meta dt {
				font-weight: 400;
				color: var(--text-hint-color, rgba(126, 126, 143, 1));
			}
			.meta dd {
				margin: 0;
				font-weight: 400;
				font-variant-numeric: tabular-nums;
			}
			pre {
				max-height: 420px;
				overflow: auto;
				margin: 0 0 0.5rem;
				padding: 0.75rem;
				border-radius: var(--gauzy-radius-sm, 0.5rem);
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.06));
				box-shadow: inset 0 0 0 1px var(--gauzy-border-default-color, rgba(126, 126, 143, 0.24));
				font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--text-basic-color);
				white-space: pre;
			}
			.toggle {
				background: none;
				border: none;
				padding: 0;
				cursor: pointer;
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--text-primary-color, var(--color-primary-default));
			}
			.toggle:hover,
			.toggle:focus-visible {
				text-decoration: underline;
			}
		`
	]
})
export class LastPayloadViewerComponent {
	@Input() payload = '';
	@Input() bytes = 0;
	@Input() sentAt: string | null = null;
	@Input() httpStatus: number | null = null;
	/** Whether the stored bytes are shown unchanged instead of formatted. */
	raw = false;

	get pretty(): string {
		try {
			return JSON.stringify(JSON.parse(this.payload), null, 2);
		} catch {
			return this.payload;
		}
	}
}
