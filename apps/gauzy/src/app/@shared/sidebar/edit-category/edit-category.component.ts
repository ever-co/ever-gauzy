import { Component, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-edit-category',
	templateUrl: 'edit-category.component.html',
	styleUrls: ['edit-category.component.scss']
})
export class EditCategoryComponent extends TranslationBaseComponent
	implements OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<EditCategoryComponent>,
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

	onIconset(icon) {
		this.dialogRef.close(icon);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
