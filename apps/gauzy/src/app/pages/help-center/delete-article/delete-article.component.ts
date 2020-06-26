import { IHelpCenterArticle } from '@gauzy/models';
import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';

@Component({
	selector: 'ga-article-category',
	templateUrl: 'delete-article.component.html',
	styleUrls: ['delete-article.component.scss']
})
export class DeleteArticleComponent extends TranslationBaseComponent
	implements OnDestroy {
	@Input() article: IHelpCenterArticle;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<DeleteArticleComponent>,
		readonly translateService: TranslateService,
		private helpCenterArticleService: HelpCenterArticleService
	) {
		super(translateService);
	}

	async delete() {
		await this.helpCenterArticleService.delete(`${this.article.id}`);
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
