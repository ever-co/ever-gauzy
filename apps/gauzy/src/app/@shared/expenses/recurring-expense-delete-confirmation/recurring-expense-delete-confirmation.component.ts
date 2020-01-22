import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { NgModel } from '@angular/forms';
import { RecurringExpenseDeletionEnum } from '@gauzy/models';

@Component({
	selector: 'ga-delete-confirmation',
	template: `
		<nb-card class="center">
			<nb-card-header>
				<h6>{{ 'POP_UPS.DELETE_RECURRING_EXPENSE' | translate }}</h6>
			</nb-card-header>
			<nb-card-body>
				<nb-radio-group [(ngModel)]="selectedOption">
					<nb-radio value="current"
						>{{ 'POP_UPS.DELETE_ONLY_THIS' | translate }} ({{
							current
						}})</nb-radio
					>
					<nb-radio
						value="future"
						*ngIf="current !== end && current !== start"
						>{{ 'POP_UPS.DELETE_THIS_FUTURE' | translate }} ({{
							current
						}}
						- {{ end }})</nb-radio
					>
					<nb-radio value="all"
						>{{ 'POP_UPS.DELETE_ALL_ENTRIES' | translate }} ({{
							start
						}}
						- {{ end }})</nb-radio
					>
				</nb-radio-group>
			</nb-card-body>
			<nb-card-footer>
				<button
					(click)="delete()"
					class="mr-3"
					status="danger"
					nbButton
					[disabled]="!selectedOption"
				>
					OK
				</button>
				<button (click)="close()" status="info" nbButton>
					{{ 'BUTTONS.CANCEL' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [``]
})
export class RecurringExpenseDeleteConfirmationComponent {
	recordType: string;
	start: string;
	current: string;
	end: string;
	selectedOption: RecurringExpenseDeletionEnum;

	constructor(
		protected dialogRef: NbDialogRef<
			RecurringExpenseDeleteConfirmationComponent
		>
	) {}

	close() {
		this.dialogRef.close();
	}

	delete() {
		this.dialogRef.close(this.selectedOption);
	}
}
