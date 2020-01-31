import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-action-confirmation',
	template: `
		<nb-card class="center">
			<nb-card-header>
				<h6>
					{{ 'POP_UPS.CONFIRM' | translate }}
				</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					{{
						'POP_UPS.ARE_YOU_SURE_YOU_WANT_TO_CHANGE_THE'
							| translate
					}}
					{{ recordType }}?
				</span>
			</nb-card-body>
			<nb-card-footer>
				<button
					(click)="confirm()"
					class="mr-3"
					status="success"
					nbButton
				>
					{{ 'POP_UPS.OK' | translate }}
				</button>
				<button (click)="close()" status="danger" nbButton>
					{{ 'POP_UPS.CANCEL' | translate }}
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
		`
	]
})
export class ActionConfirmationComponent {
	recordType: string;
	constructor(
		protected dialogRef: NbDialogRef<ActionConfirmationComponent>
	) {}

	close() {
		this.dialogRef.close();
	}

	confirm() {
		this.dialogRef.close('ok');
	}
}
