import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-candidate-action-confirmation',
	template: `
		<nb-card class="center">
			<nb-card-header>
				<h6>{{ 'FORM.CONFIRM' | translate }}</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					{{ 'FORM.CANDIDATE_ACTION_CONFIRMATION.SURE' | translate }}
					<span *ngIf="isReject">{{
						'FORM.CANDIDATE_ACTION_CONFIRMATION.REJECT' | translate
					}}</span>
					<span *ngIf="!isReject">{{
						'FORM.CANDIDATE_ACTION_CONFIRMATION.HIRE' | translate
					}}</span>
					{{
						'FORM.CANDIDATE_ACTION_CONFIRMATION.CANDIDATE'
							| translate
					}}
					{{ recordType }}
				</span>
			</nb-card-body>
			<nb-card-footer>
				<button
					(click)="action()"
					class="mr-3"
					status="danger"
					nbButton
				>
					OK
				</button>
				<button (click)="close()" status="info" nbButton>
					{{ 'BUTTONS.CANCEL' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			nb-card-body {
				text-align: center;
			}

			.center {
				align-items: center;
				width: 300px;
			}
		`,
	],
})
export class CandidateActionConfirmationComponent {
	recordType: string;
	isReject: boolean;
	constructor(
		protected dialogRef: NbDialogRef<CandidateActionConfirmationComponent>
	) {}

	close() {
		this.dialogRef.close();
	}

	action() {
		this.dialogRef.close('ok');
	}
}
