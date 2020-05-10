import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-archive-confirmation',
	template: `
		<nb-card class="center">
			<nb-card-header>
				<h6>{{ 'FORM.CONFIRM' | translate }}</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					{{ 'FORM.ARCHIVE_CONFIRMATION.SURE' | translate }}
					{{ recordType }}
					{{ 'FORM.DELETE_CONFIRMATION.RECORD' | translate }}?
				</span>
			</nb-card-body>
			<nb-card-footer>
				<button
					(click)="archive()"
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
		`
	]
})
export class ArchiveConfirmationComponent {
	recordType: string;
	constructor(
		protected dialogRef: NbDialogRef<ArchiveConfirmationComponent>
	) {}

	close() {
		this.dialogRef.close();
	}

	archive() {
		this.dialogRef.close('ok');
	}
}
