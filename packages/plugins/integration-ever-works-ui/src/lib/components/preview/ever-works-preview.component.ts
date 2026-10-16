import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnChanges } from '@angular/core';
import { NbAlertModule, NbButtonModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EverWorksSyncPhasePreview, EverWorksSyncPreview, EverWorksUiService } from '../../services/ever-works.service';
import { errorText } from '../shared/ever-works-ui.utils';

/**
 * The dry run of a mapping's sync (plan 03 §C.6 step 2): per phase, the records on each side, how many
 * are paired, what the sync would create on each side and what is still to pair on its tab. It writes
 * nothing; phases this installation does not sync yet are shown greyed with the reason.
 */
@Component({
	selector: 'ngx-ever-works-preview',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbAlertModule, NbButtonModule, TranslatePipe],
	template: `
		<p>{{ 'EVER_WORKS.PREVIEW.INTRO' | translate }}</p>
		@if (error) {
			<nb-alert status="danger" role="alert" data-test="preview-error">{{ error }}</nb-alert>
		}
		@if (loading) {
			<p data-test="preview-loading">{{ 'EVER_WORKS.COMMON.LOADING' | translate }}</p>
		} @else if (preview) {
			<table class="table" data-test="preview">
				<thead>
					<tr>
						<th>{{ 'EVER_WORKS.PREVIEW.PHASE' | translate }}</th>
						<th>{{ 'EVER_WORKS.PREVIEW.IN_EVER_WORKS' | translate }}</th>
						<th>{{ 'EVER_WORKS.PREVIEW.IN_GAUZY' | translate }}</th>
						<th>{{ 'EVER_WORKS.PREVIEW.CREATES_IN_GAUZY' | translate }}</th>
						<th>{{ 'EVER_WORKS.PREVIEW.CREATES_IN_EVER_WORKS' | translate }}</th>
						<th>{{ 'EVER_WORKS.PREVIEW.TO_PAIR' | translate }}</th>
					</tr>
				</thead>
				<tbody>
					@for (row of preview.phases; track row.phase) {
						<tr [class.unsupported]="!row.supported" [attr.data-test]="'phase-' + row.phase">
							<td>
								<div>{{ 'EVER_WORKS.PHASES.' + row.phase | translate }}</div>
								<small class="direction">{{ 'EVER_WORKS.DIRECTIONS.VALUES.' + row.direction | translate }}</small>
								@if (!row.supported) {
									<small class="note" data-test="not-supported"
										>{{ 'EVER_WORKS.PREVIEW.NOT_SUPPORTED' | translate }}{{ row.note ? ': ' + row.note : '' }}</small
									>
								} @else if (row.note) {
									<small class="note">{{ row.note }}</small>
								}
							</td>
							<td>
								@if (row.everWorks) {
									{{ 'EVER_WORKS.PREVIEW.LINKED_OF' | translate: { linked: row.everWorks.linked, total: row.everWorks.total } }}
									@if (row.everWorks.truncated) {
										<small>({{ 'EVER_WORKS.PREVIEW.TRUNCATED' | translate }})</small>
									}
								} @else {
									—
								}
							</td>
							<td>
								@if (row.gauzy) {
									{{ 'EVER_WORKS.PREVIEW.LINKED_OF' | translate: { linked: row.gauzy.linked, total: row.gauzy.total } }}
								} @else {
									—
								}
							</td>
							<td data-test="creates-in-gauzy">{{ row.creates.inGauzy }}</td>
							<td data-test="creates-in-ever-works">{{ row.creates.inEverWorks }}</td>
							<td data-test="to-pair">{{ toPair(row) }}</td>
						</tr>
					}
				</tbody>
			</table>
			<button nbButton ghost size="small" type="button" data-test="refresh-preview" (click)="load()">
				{{ 'EVER_WORKS.COMMON.REFRESH' | translate }}
			</button>
		}
	`,
	styles: [
		`
			.unsupported {
				opacity: 0.55;
			}
			.note,
			.direction {
				display: block;
				opacity: 0.8;
			}
		`
	]
})
export class EverWorksPreviewComponent implements OnChanges {
	private readonly api = inject(EverWorksUiService);
	private readonly cdr = inject(ChangeDetectorRef);

	@Input() organizationId: string | null = null;
	@Input() integrationTenantId: string | null = null;

	preview: EverWorksSyncPreview | null = null;
	loading = false;
	error: string | null = null;
	private request = 0;

	ngOnChanges(): void {
		this.load();
	}

	load(): void {
		if (!this.integrationTenantId) return;
		// A later request (another organization, a refresh) wins over an earlier one still in flight.
		const request = ++this.request;
		this.loading = true;
		this.error = null;
		this.cdr.markForCheck();
		this.api.preview(this.organizationId, this.integrationTenantId).subscribe({
			next: (preview) => {
				if (request !== this.request) return;
				this.preview = preview;
				this.loading = false;
				this.cdr.markForCheck();
			},
			error: (error) => {
				if (request !== this.request) return;
				this.preview = null;
				this.loading = false;
				this.error = errorText(error);
				this.cdr.markForCheck();
			}
		});
	}

	toPair(row: EverWorksSyncPhasePreview): string {
		if (!row.toPair) return '—';
		return row.toPair.gauzy ? `${row.toPair.everWorks} / ${row.toPair.gauzy}` : String(row.toPair.everWorks);
	}
}
