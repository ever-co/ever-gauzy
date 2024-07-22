import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-delete-confirmation',
	template: `
		<nb-card class="center">
			<nb-card-header>
				<span class="cancel"><i class="fas fa-times" (click)="close()"></i></span>
				<h6 class="title">{{ 'FORM.CONFIRM' | translate }}</h6>
			</nb-card-header>
			<nb-card-body>
				<span>
					{{ 'FORM.DELETE_CONFIRMATION.SURE' | translate }}
					{{ recordType | translate }}
					<span *ngIf="isRecord"> {{ 'FORM.DELETE_CONFIRMATION.RECORD' | translate }} </span>?
				</span>
			</nb-card-body>
			<nb-card-footer>
				<button (click)="close()" status="basic" outline nbButton>
					{{ 'BUTTONS.CANCEL' | translate }}
				</button>
				<button (click)="delete()" class="mr-3 ml-3" status="danger" nbButton>
					{{ 'BUTTONS.OK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styleUrls: ['delete-confirmation.component.scss']
})
export class DeleteConfirmationComponent {
	recordType: string;
	isRecord: boolean = true;

	constructor(protected readonly dialogRef: NbDialogRef<DeleteConfirmationComponent>) {}

	close() {
		this.dialogRef.close();
	}

	delete() {
		this.dialogRef.close('ok');
	}
}
