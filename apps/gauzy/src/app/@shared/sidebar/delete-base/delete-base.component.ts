import { Component, OnDestroy, Input, ErrorHandler } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter } from '@gauzy/models';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';
import { HelpCenterService } from '../../../@core/services/help-center.service';
import { HelpCenterAuthorService } from '../../../@core/services/help-center-author.service';

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
		private helpCenterAuthorService: HelpCenterAuthorService,
		private helpCenterArticleService: HelpCenterArticleService,
		private helpCenterService: HelpCenterService,
		private errorHandler: ErrorHandler
	) {
		super(translateService);
	}

	async deleteBase() {
		const result = await this.helpCenterService.findByBaseId(this.base.id);
		if (result.length !== 0) {
			result.forEach((category) => this.deleteArticles(category.id));
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

	async deleteArticles(id) {
		const result = await this.helpCenterArticleService.findByCategoryId(id);
		if (result) {
			let hasArticles = false;
			result.forEach(async (article) => {
				if (article.categoryId === id) {
					hasArticles = true;
					try {
						await this.helpCenterAuthorService.deleteBulkByArticleId(
							article.id
						);
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
			if (hasArticles)
				try {
					await this.helpCenterArticleService.deleteBulkByCategoryId(
						id
					);
				} catch (error) {
					this.errorHandler.handleError(error);
				}
		}
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
