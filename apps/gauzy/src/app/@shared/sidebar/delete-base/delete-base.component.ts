import { Component, OnDestroy, Input, ErrorHandler } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter } from '@gauzy/models';
// import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';
import { HelpCenterService } from '../../../@core/services/help-center.service';

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
		readonly translateService: TranslateService,
		// private helpCenterArticleService: HelpCenterArticleService,
		private helpCenterService: HelpCenterService,
		private errorHandler: ErrorHandler
	) {
		super(translateService);
	}

	async deleteBase() {
		const result = await this.helpCenterService.findByBaseId(this.base.id);
		if (result.length !== 0) {
			try {
				await this.helpCenterService.deleteBulkByBaseId(this.base.id);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
		try {
			await this.helpCenterService.delete(this.base.id);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		this.dialogRef.close(this.base);
	}

	// async deleteArticles() {}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
