import { IHelpCenterArticle } from '@gauzy/models';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { AddArticleComponent } from './add-article/add-article.component';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { DeleteArticleComponent } from './delete-article/delete-article.component';
import { EditArticleComponent } from './edit-article/edit-article.component';
import { HelpCenterArticleService } from '../../@core/services/help-center-article.service';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ga-help-center',
	templateUrl: './help-center.component.html',
	styleUrls: ['./help-center.component.scss']
})
export class HelpCenterComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private helpCenterArticleService: HelpCenterArticleService,
		private readonly toastrService: NbToastrService
	) {
		super(translateService);
	}
	public nodes: IHelpCenterArticle[] = [];
	ngOnInit() {
		this.loadArticles();
	}

	async loadArticles() {
		const result = await this.helpCenterArticleService.findByCategoryId(
			'id'
		);
		if (result) {
			this.nodes = result;
		}
	}

	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.${text}`)
		);
	}

	async addNode() {
		const dialog = this.dialogService.open(AddArticleComponent);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('CREATED');
			this.loadArticles();
		}
	}

	async deleteNode(i: number) {
		const dialog = this.dialogService.open(DeleteArticleComponent, {
			context: {
				article: this.nodes[i]
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('DELETED');
			this.loadArticles();
		}
	}

	editNode() {
		this.dialogService.open(EditArticleComponent);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
