import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-archive-confirmation',
	template: `
		<nb-card>
			<nb-card-header class="d-flex flex-column">
				<span class="cancel"><i class="fas fa-times" (click)="close()"></i></span>
				<h6 class="title">{{ 'FORM.CONFIRM' | translate }}</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					{{ 'FORM.ARCHIVE_CONFIRMATION.SURE' | translate }}
					{{ recordType }}
					{{ 'FORM.DELETE_CONFIRMATION.RECORD' | translate }}?
				</span>
			</nb-card-body>
			<nb-card-footer>
				<button (click)="close()" status="basic" outline nbButton>
					{{ 'BUTTONS.CANCEL' | translate }}
				</button>
				<button (click)="archive()" class="mr-3 ml-3" status="danger" nbButton>
					{{ 'BUTTONS.OK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styleUrls: ['../delete-confirmation/delete-confirmation.component.scss']
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
