import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter } from '@gauzy/models';

@Component({
	selector: 'ga-delete-base',
	templateUrl: 'delete-base.component.html',
	styleUrls: ['delete-base.component.scss']
})
export class DeleteBaseComponent extends TranslationBaseComponent
	implements OnDestroy {
	@Input() base: IHelpCenter;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<DeleteBaseComponent>,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	deleteBase() {}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
