import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ga-archive-confirmation',
    template: `
		<nb-card class="confirm-dialog">
			<nb-card-header class="dialog-header">
				<div class="heading">
					<span class="title-badge"><nb-icon icon="archive-outline"></nb-icon></span>
					<h5 class="dialog-title">{{ 'FORM.CONFIRM' | translate }}</h5>
				</div>
				<button
					type="button"
					class="close"
					nbButton
					ghost
					size="small"
					status="basic"
					[attr.aria-label]="'BUTTONS.CLOSE' | translate"
					(click)="close()"
				>
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</nb-card-header>
			<nb-card-body class="dialog-body">
				<p class="message">
					{{ 'FORM.ARCHIVE_CONFIRMATION.SURE' | translate }}
					<strong>{{ recordType }}</strong>
					{{ 'FORM.DELETE_CONFIRMATION.RECORD' | translate }}?
				</p>
			</nb-card-body>
			<nb-card-footer class="dialog-footer">
				<button type="button" nbButton ghost status="basic" size="small" (click)="close()">
					{{ 'BUTTONS.CANCEL' | translate }}
				</button>
				<button type="button" nbButton status="danger" size="small" (click)="archive()">
					{{ 'BUTTONS.OK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
    styleUrls: ['./archive-confirmation.component.scss'],
    standalone: false
})
export class ArchiveConfirmationComponent {
	recordType: string;

	constructor(protected readonly dialogRef: NbDialogRef<ArchiveConfirmationComponent>) {}

	close() {
		this.dialogRef.close();
	}

	archive() {
		this.dialogRef.close('ok');
	}
}
