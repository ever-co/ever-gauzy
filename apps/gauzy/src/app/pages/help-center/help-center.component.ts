import { IHelpCenterArticle, IHelpCenter } from '@gauzy/models';
import { Component, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { AddArticleComponent } from './add-article/add-article.component';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { DeleteArticleComponent } from './delete-article/delete-article.component';
import { HelpCenterArticleService } from '../../@core/services/help-center-article.service';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ga-help-center',
	templateUrl: './help-center.component.html',
	styleUrls: ['./help-center.component.scss']
})
export class HelpCenterComponent extends TranslationBaseComponent
	implements OnDestroy {
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
	public categoryName = '';
	public categoryId = '';

	clickedNode(clickedNode: IHelpCenter) {
		this.categoryId = clickedNode.id;
		this.categoryName =
			clickedNode.flag === 'category' ? clickedNode.name : '';
		this.loadArticles(this.categoryId);
	}

	deletedNode() {
		this.categoryId = '';
		this.categoryName = '';
		this.loadArticles('id');
	}

	async loadArticles(id) {
		const result = await this.helpCenterArticleService.findByCategoryId(id);
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
		const chosenType = 'add';
		const dialog = this.dialogService.open(AddArticleComponent, {
			context: {
				article: null,
				editType: chosenType,
				length: this.nodes.length,
				id: this.categoryId
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('CREATED');
			this.loadArticles(this.categoryId);
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
			this.loadArticles(this.categoryId);
		}
	}

	async editNode(i: number) {
		const chosenType = 'edit';
		const dialog = this.dialogService.open(AddArticleComponent, {
			context: {
				article: this.nodes[i],
				editType: chosenType,
				length: this.nodes.length,
				id: this.categoryId
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('EDITED');
			this.loadArticles(this.categoryId);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
