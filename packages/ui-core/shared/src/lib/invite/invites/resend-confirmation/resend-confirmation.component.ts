import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ga-resend-confirmation',
    template: `
		<nb-card class="center">
			<nb-card-header class="d-flex flex-column">
				<span class="cancel"
					><i class="fas fa-times" (click)="close()"></i
				></span>
				<h6 class="title">{{ 'POP_UPS.CONFIRM' | translate }}</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					{{
						'POP_UPS.ARE_YOU_SURE_YOU_WANT_TO_RESEND_THE_INVITE_TO'
							| translate
					}}
					{{ email }} ?
				</span>
			</nb-card-body>
			<nb-card-footer class="text-align-left">
				<button (click)="close()" status="basic" outline nbButton>
					{{ 'POP_UPS.CANCEL' | translate }}
				</button>
				<button
					(click)="confirm()"
					class="mr-3 ml-3"
					status="success"
					nbButton
				>
					{{ 'POP_UPS.OK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
    styles: [
        `
			.center {
				width: 300px;
			}
		`
    ],
    styleUrls: ['resend-confirmation.component.scss'],
    standalone: false
})
export class ResendConfirmationComponent {
	email: string;
	constructor(
		protected dialogRef: NbDialogRef<ResendConfirmationComponent>
	) {}

	close() {
		this.dialogRef.close();
	}

	confirm() {
		this.dialogRef.close('ok');
	}
}
