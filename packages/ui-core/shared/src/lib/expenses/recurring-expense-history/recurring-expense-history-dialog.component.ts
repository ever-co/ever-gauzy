import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
import moment from 'moment';
import { IOrganization, IRecurringExpenseModel } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

/** One period of the expense as the dialog lists it. */
export interface IRecurringExpenseHistoryRow {
	record: IRecurringExpenseModel;
	/** e.g. "Mar 2026", in the viewer's language. */
	start: string;
	/** The period's last month; `null` when it has no end, the same as `start` when it is one month long. */
	end: string | null;
	/** The period that covers today. */
	isCurrent: boolean;
}

/**
 * The history of a recurring expense's amount, in a dialog: every period of it, oldest first — the months it ran
 * and the amount it charged then, the one that covers today marked. Opened from the History button of the
 * recurring expenses lists.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-history-dialog',
	template: `
		<nb-card class="history-dialog">
			<nb-card-header class="history-dialog__header">
				<div class="history-dialog__heading">
					<h6 class="history-dialog__title">{{ 'POP_UPS.EXPENSE_HISTORY' | translate }}</h6>
					@if (rows.length) {
						<span class="history-dialog__summary">
							@if (name) {
								{{ name }} ·
							}
							{{
								(rows.length === 1 ? 'POP_UPS.HISTORY_SUMMARY_ONE' : 'POP_UPS.HISTORY_SUMMARY')
									| translate : { count: rows.length, month: firstMonth }
							}}
						</span>
					}
				</div>
				<button
					type="button"
					class="history-dialog__close"
					[attr.aria-label]="'BUTTONS.CLOSE' | translate"
					(click)="close()"
				>
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</nb-card-header>

			<nb-card-body class="history-dialog__body">
				<table class="history-dialog__table">
					<thead>
						<tr>
							<th scope="col">{{ 'FORM.LABELS.PERIOD' | translate }}</th>
							<th scope="col" class="is-amount">{{ 'POP_UPS.AMOUNT' | translate }}</th>
						</tr>
					</thead>
					<tbody>
						@for (row of rows; track row.record.id ?? $index) {
							<tr [class.is-current]="row.isCurrent">
								<td>
									<span class="history-dialog__period">
										{{ row.start }}
										@if (row.end !== row.start) {
											–
											@if (row.end) {
												{{ row.end }}
											} @else {
												<span class="history-dialog__muted">{{
													'RECURRING_EXPENSE_VIEW.NO_END_DATE' | translate
												}}</span>
											}
										}
									</span>
									@if (row.isCurrent) {
										<span class="history-dialog__current">{{ 'POP_UPS.CURRENT_PERIOD' | translate }}</span>
									}
								</td>
								<td class="is-amount">
									{{
										row.record?.value
											| currency : row.record?.currency
											| position : organization?.currencyPosition
									}}
								</td>
							</tr>
						}
					</tbody>
				</table>
			</nb-card-body>

			<nb-card-footer class="history-dialog__footer">
				<button nbButton outline status="basic" size="small" type="button" (click)="close()">
					{{ 'BUTTONS.CLOSE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styleUrls: ['./recurring-expense-history-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class RecurringExpenseHistoryDialogComponent implements OnInit {
	/** Every period of the recurring expense, oldest first. */
	records: IRecurringExpenseModel[] = [];
	/** The expense's name (its category), under the title: which expense the history is of. */
	name: string;

	rows: IRecurringExpenseHistoryRow[] = [];
	/** The first period's first month, for the summary under the title. */
	firstMonth = '';

	/** For the amounts' currency position, as the inline history read it. */
	organization: IOrganization;

	constructor(
		private readonly dialogRef: NbDialogRef<RecurringExpenseHistoryDialogComponent>,
		private readonly translateService: TranslateService,
		private readonly store: Store
	) {}

	ngOnInit(): void {
		this.describe();
		// The months are written in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.describe());
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => (this.organization = organization));
	}

	close(): void {
		this.dialogRef.close();
	}

	/** Works out each period's months, oldest first, and which one covers today. */
	private describe(): void {
		const locale = this.translateService.getCurrentLang() || 'en';
		const today = moment().startOf('month');
		const sorted = [...(this.records ?? [])].sort(
			(a, b) => a.startYear - b.startYear || a.startMonth - b.startMonth
		);
		this.rows = sorted.map((record) => {
			const start = moment([record.startYear, record.startMonth, 1]);
			const hasEnd = record.endYear !== null && record.endYear !== undefined && record.endMonth !== null && record.endMonth !== undefined;
			const end = hasEnd ? moment([record.endYear, record.endMonth, 1]) : null;
			const startText = start.clone().locale(locale).format('MMM YYYY');
			return {
				record,
				start: startText,
				end: end ? end.clone().locale(locale).format('MMM YYYY') : null,
				isCurrent: !today.isBefore(start) && (!end || !today.isAfter(end))
			};
		});
		this.firstMonth = sorted.length
			? moment([sorted[0].startYear, sorted[0].startMonth, 1]).locale(locale).format('MMMM YYYY')
			: '';
	}
}
