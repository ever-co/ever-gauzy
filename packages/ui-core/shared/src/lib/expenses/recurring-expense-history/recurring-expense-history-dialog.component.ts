import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
import { IOrganization, IRecurringExpenseModel } from '@gauzy/contracts';
import { Store, monthNames } from '@gauzy/ui-core/core';

/**
 * The history of a recurring expense's amount, in a dialog: every period of it, oldest first — the month it
 * starts and the amount it charges from then. Opened from the History button of the recurring expenses lists.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-history-dialog',
	template: `
		<nb-card class="history-dialog">
			<nb-card-header class="history-dialog__header">
				<div class="history-dialog__heading">
					<h6 class="history-dialog__title">{{ 'POP_UPS.EXPENSE_HISTORY' | translate }}</h6>
					@if (name) {
						<span class="history-dialog__name">{{ name }}</span>
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
							<th scope="col">{{ 'POP_UPS.STARTS_ON' | translate }}</th>
							<th scope="col" class="is-amount">{{ 'POP_UPS.NEW_EXPENSE_VALUE' | translate }}</th>
						</tr>
					</thead>
					<tbody>
						@for (record of records; track record.id ?? $index) {
							<tr>
								<td>{{ monthName(record.startMonth) }} {{ record.startYear }}</td>
								<td class="is-amount">
									{{
										record?.value
											| currency : record?.currency
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

	/** For the amounts' currency position, as the inline history read it. */
	organization: IOrganization;

	constructor(private readonly dialogRef: NbDialogRef<RecurringExpenseHistoryDialogComponent>, private readonly store: Store) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => (this.organization = organization));
	}

	monthName(month: number): string {
		return monthNames[month] ?? '';
	}

	close(): void {
		this.dialogRef.close();
	}
}
