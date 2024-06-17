import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-action-confirmation',
	template: `
		<nb-card>
			<nb-card-header>
				<span class="cancel"><i class="fas fa-times" (click)="close()"></i></span>
				<h6 class="title">
					{{ 'POP_UPS.CONFIRM' | translate }}
				</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					{{ 'POP_UPS.ARE_YOU_SURE_YOU_WANT_TO_CHANGE_THE' | translate }}
					{{ recordType }}?
				</span>
			</nb-card-body>
			<nb-card-footer>
				<button (click)="close()" status="basic" outline nbButton>
					{{ 'POP_UPS.CANCEL' | translate }}
				</button>
				<button (click)="confirm()" class="mr-3 ml-3" status="success" nbButton>
					{{ 'POP_UPS.OK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			nb-card-footer {
				text-align: left;
				width: 100%;
			}
			.center {
				align-items: center;
				width: 300px;
			}
		`
	],
	styleUrls: ['../delete-confirmation/delete-confirmation.component.scss']
})
export class ActionConfirmationComponent {
	recordType: string;
	constructor(protected dialogRef: NbDialogRef<ActionConfirmationComponent>) {}

	close() {
		this.dialogRef.close();
	}

	confirm() {
		this.dialogRef.close('ok');
	}
}
