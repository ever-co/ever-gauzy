import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ga-delete-confirmation',
    template: `
		<nb-card class="center">
		  <nb-card-header>
		    <h6 class="title">{{ 'FORM.CONFIRM' | translate }}</h6>
		    <button
		      type="button"
		      class="cancel"
		      [attr.aria-label]="'BUTTONS.CLOSE' | translate"
		      (click)="close()"
		    >
		      <i class="fas fa-times" aria-hidden="true"></i>
		    </button>
		  </nb-card-header>
		  <nb-card-body>
		    <span>
		      {{ 'FORM.DELETE_CONFIRMATION.SURE' | translate }}
		      {{ recordType | translate }}
		      @if (isRecord) {
		        <span> {{ 'FORM.DELETE_CONFIRMATION.RECORD' | translate }} </span>
		        }?
		      </span>
		    </nb-card-body>
		    <nb-card-footer>
		      <button (click)="close()" status="basic" ghost nbButton size="small">
		        {{ 'BUTTONS.CANCEL' | translate }}
		      </button>
		      <button (click)="delete()" class="mr-3 ml-3" status="danger" nbButton size="small">
		        {{ 'BUTTONS.OK' | translate }}
		      </button>
		    </nb-card-footer>
		  </nb-card>
		`,
    styleUrls: ['delete-confirmation.component.scss'],
    standalone: false
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
