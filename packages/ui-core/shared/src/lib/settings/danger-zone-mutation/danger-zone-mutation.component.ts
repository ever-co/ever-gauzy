import { Component, Output, EventEmitter } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
    selector: 'ga-danger-zone-mutation',
    templateUrl: './danger-zone-mutation.component.html',
    styleUrls: ['./danger-zone-mutation.component.scss'],
    standalone: false
})
export class DangerZoneMutationComponent extends TranslationBaseComponent {
	recordType: string;
	title: string;

	@Output() emitData: EventEmitter<string> = new EventEmitter<string>();

	data: string;

	constructor(
		public readonly translate: TranslateService,
		public readonly dialogRef: NbDialogRef<DangerZoneMutationComponent>,
		private readonly toastrService: ToastrService
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
		if (this.data === this.recordType) {
			this.dialogRef.close('ok');
		} else {
			this.toastrService.danger('NOTES.DANGER_ZONE.WRONG_INPUT_DATA');
		}
	}
}
