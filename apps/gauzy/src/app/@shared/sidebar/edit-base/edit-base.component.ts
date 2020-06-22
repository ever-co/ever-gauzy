import { Component, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-edit-base',
	templateUrl: 'edit-base.component.html',
	styleUrls: ['edit-base.component.scss']
})
export class EditBaseComponent extends TranslationBaseComponent
	implements OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<EditBaseComponent>,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}
	public selectedLang = '';
	public selectedColor = '';
	public languages = ['en', 'ru', 'he', 'bg'];
	public colors = ['black', 'blue'];
	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
