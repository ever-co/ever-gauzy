import { Component, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-add-icon',
	templateUrl: 'add-icon.component.html',
	styleUrls: ['add-icon.component.scss']
})
export class AddIconComponent extends TranslationBaseComponent
	implements OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<AddIconComponent>,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	onIconset(icon) {
		this.dialogRef.close(icon);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
