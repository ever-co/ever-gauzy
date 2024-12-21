import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { CountdownConfig, CountdownEvent } from 'ngx-countdown';

@Component({
    selector: 'ga-countdown-confirmation',
    template: `
		<nb-card class="center">
			<nb-card-header>
				<h6>{{ 'FORM.CONFIRM' | translate }}</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					<b>{{ recordType }}</b>
					{{ 'FORM.COUNTDOWN_CONFIRMATION.WAS' | translate }}
					{{
						((isEnabled ? 'FORM.COUNTDOWN_CONFIRMATION.ENABLED' : 'FORM.COUNTDOWN_CONFIRMATION.DISABLED')
							| translate) + '?'
					}}
				</span>
				<div class="mt-2">
					{{ 'FORM.COUNTDOWN_CONFIRMATION.WAIT_UNTIL_RELOAD' | translate }}
					<countdown #cd [config]="countDownConfig" (event)="handleActionEvent($event)"></countdown>
				</div>
			</nb-card-body>
			<nb-card-footer>
				<button (click)="continue()" class="mr-3" status="danger" nbButton>
					{{ 'BUTTONS.CONTINUE' | translate }}
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
				width: 350px;
			}
		`
    ],
    standalone: false
})
export class CountdownConfirmationComponent {
	recordType: string;
	isEnabled: boolean;
	countDownConfig: CountdownConfig = { leftTime: 5 };

	constructor(protected readonly dialogRef: NbDialogRef<CountdownConfirmationComponent>) {}

	handleActionEvent(e: CountdownEvent) {
		if (e.action === 'done') {
			this.dialogRef.close('continue');
		}
	}

	close() {
		this.dialogRef.close();
	}

	continue() {
		this.dialogRef.close('continue');
	}
}
