import { IHelpCenterArticle } from '@gauzy/contracts';
import { Component, OnDestroy, Input, ErrorHandler } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { HelpCenterArticleService, HelpCenterAuthorService } from '@gauzy/ui-core/core';

@Component({
    selector: 'ga-article-category',
    templateUrl: 'delete-article.component.html',
    styleUrls: ['delete-article.component.scss'],
    standalone: false
})
export class DeleteArticleComponent extends TranslationBaseComponent implements OnDestroy {
	@Input() article: IHelpCenterArticle;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<DeleteArticleComponent>,
		readonly translateService: TranslateService,
		private helpCenterAuthorService: HelpCenterAuthorService,
		private helpCenterArticleService: HelpCenterArticleService,
		private errorHandler: ErrorHandler
	) {
		super(translateService);
	}

	async delete() {
		try {
			await this.helpCenterArticleService.delete(`${this.article.id}`);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		try {
			await this.helpCenterAuthorService.deleteBulkByArticleId(this.article.id);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		this.dialogRef.close(this.article);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
