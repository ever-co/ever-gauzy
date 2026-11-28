import { Component, ChangeDetectionStrategy } from '@angular/core';
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
		      @if (confirmName) {
		        <div class="confirm-name">
		          <label class="confirm-name-label" for="delete-confirm-name">
		            {{ 'POP_UPS.TYPE_NAME_TO_CONFIRM' | translate }} <strong>{{ confirmName }}</strong>
		          </label>
		          <input
		            id="delete-confirm-name"
		            nbInput
		            fullWidth
		            fieldSize="small"
		            type="text"
		            autocomplete="off"
		            [placeholder]="confirmName"
		            [(ngModel)]="typedName"
		            (keydown.enter)="canDelete && delete()"
		          />
		        </div>
		      }
		    </nb-card-body>
		    <nb-card-footer>
		      <button (click)="close()" status="basic" ghost nbButton size="small">
		        {{ 'BUTTONS.CANCEL' | translate }}
		      </button>
		      <button (click)="delete()" class="mr-3 ml-3" status="danger" nbButton size="small" [disabled]="!canDelete">
		        {{ 'BUTTONS.OK' | translate }}
		      </button>
		    </nb-card-footer>
		  </nb-card>
		`,
    styleUrls: ['delete-confirmation.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DeleteConfirmationComponent {
	recordType: string;
	isRecord: boolean = true;
	/**
	 * The record's name. When given, the viewer has to type it before Ok is enabled, so the wrong record is not
	 * deleted by mistake — as the recurring expense's delete asks. Case and surrounding spaces do not matter.
	 * Without it the dialog is the plain confirmation it always was.
	 */
	confirmName: string;
	typedName = '';

	constructor(protected readonly dialogRef: NbDialogRef<DeleteConfirmationComponent>) {}

	/** No name is asked for, or the name typed matches it. */
	get canDelete(): boolean {
		if (!this.confirmName) {
			return true;
		}
		return (
			(this.typedName || '').trim().localeCompare(this.confirmName.trim(), undefined, { sensitivity: 'accent' }) ===
			0
		);
	}

	close() {
		this.dialogRef.close();
	}

	delete() {
		if (!this.canDelete) {
			return;
		}
		this.dialogRef.close('ok');
	}
}
