import { IHelpCenter } from '@gauzy/models';
import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { HelpCenterService } from '../../../@core/services/help-center.service';

@Component({
	selector: 'ga-delete-category',
	templateUrl: 'delete-category.component.html',
	styleUrls: ['delete-category.component.scss']
})
export class DeleteCategoryComponent extends TranslationBaseComponent
	implements OnDestroy {
	@Input() category: IHelpCenter;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<DeleteCategoryComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService
	) {
		super(translateService);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	async deleteCategory() {
		await this.helpCenterService.deleteBulk(this.category.id);
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
