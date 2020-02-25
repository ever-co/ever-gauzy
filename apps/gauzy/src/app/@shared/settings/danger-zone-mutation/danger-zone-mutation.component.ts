import { Component, Output, EventEmitter } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-danger-zone-mutation',
	templateUrl: './danger-zone-mutation.component.html',
	styleUrls: ['./danger-zone-mutation.component.scss']
})
export class DangerZoneMutationComponent extends TranslationBaseComponent {
	recordType: string;

	@Output() emitData: EventEmitter<string> = new EventEmitter<string>();

	data: string;

	constructor(
		protected dialogRef: NbDialogRef<DangerZoneMutationComponent>,
		private translate: TranslateService,
		private toastrService: NbToastrService
	) {
		super(translate);
	}

	close() {
		this.dialogRef.close();
	}

	sendData() {
		this.emitData.emit(this.data);
	}

	delete() {
		if (this.data === 'REMOVE ALL DATA') {
			this.dialogRef.close('ok');
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.DANGER_ZONE.DELETE_ACCOUNT_WRONG_DATA'
				),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}
}
