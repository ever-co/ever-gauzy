import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Shows a report: pretty-printed for reading, with the size and, for a sent report, when it was sent
 * and the HTTP status. The text shown is parsed from the exact stored bytes; the byte count is theirs.
 */
@Component({
	selector: 'ngx-ever-stats-payload-viewer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, TranslateModule],
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
		<pre data-test="payload">{{ pretty }}</pre>
	`,
	styles: [
		`
			.meta {
				display: grid;
				grid-template-columns: max-content auto;
				gap: 4px 12px;
				margin: 0 0 8px;
			}
			pre {
				max-height: 420px;
				overflow: auto;
				padding: 12px;
				border-radius: 4px;
				background: var(--background-basic-color-2, #f7f9fc);
				font-size: 12px;
				white-space: pre;
			}
		`
	]
})
export class LastPayloadViewerComponent {
	@Input() payload = '';
	@Input() bytes = 0;
	@Input() sentAt: string | null = null;
	@Input() httpStatus: number | null = null;

	get pretty(): string {
		try {
			return JSON.stringify(JSON.parse(this.payload), null, 2);
		} catch {
			return this.payload;
		}
	}
}
