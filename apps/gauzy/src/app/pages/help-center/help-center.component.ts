import { SafeHtml, DomSanitizer } from '@angular/platform-browser';
import {
	IHelpCenterArticle,
	IHelpCenter,
	IHelpCenterAuthor,
	Employee
} from '@gauzy/models';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { AddArticleComponent } from './add-article/add-article.component';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { DeleteArticleComponent } from './delete-article/delete-article.component';
import { HelpCenterArticleService } from '../../@core/services/help-center-article.service';
import { first, takeUntil } from 'rxjs/operators';
import { HelpCenterAuthorService } from '../../@core/services/help-center-author.service';
import { EmployeesService } from '../../@core/services';
import { FormControl } from '@angular/forms';

@Component({
	selector: 'ga-help-center',
	templateUrl: './help-center.component.html',
	styleUrls: ['./help-center.component.scss']
})
export class HelpCenterComponent extends TranslationBaseComponent
	implements OnDestroy, OnInit {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private helpCenterArticleService: HelpCenterArticleService,
		private readonly toastrService: NbToastrService,
		private helpCenterAuthorService: HelpCenterAuthorService,
		private employeeService: EmployeesService,
		private sanitizer: DomSanitizer
	) {
		super(translateService);
	}
	public showData: boolean[] = [];
	public dataArray: SafeHtml[] = [];
	public employees: Employee[] = [];
	public articleList: IHelpCenterArticle[] = [];
	public isResetSelect = false;
	public filteredArticles: IHelpCenterArticle[] = [];
	public search: FormControl = new FormControl();
	public categoryName = '';
	public categoryId = '';
	public authors: IHelpCenterAuthor[] = [];
	filterParams = { name: '', authorId: '' };

	ngOnInit() {
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
		this.search.valueChanges.subscribe((item) => {
			this.filterByName(item);
		});
	}

	clickedNode(clickedNode: IHelpCenter) {
		this.categoryId = clickedNode.id;
		this.categoryName =
			clickedNode.flag === 'category' ? clickedNode.name : '';
		this.loadArticles(this.categoryId);
	}

	openArticle(i) {
		this.showData[i] = !this.showData[i];
	}

	deletedNode() {
		this.categoryId = '';
		this.categoryName = '';
		this.loadArticles('id');
	}

	async loadArticles(id) {
		this.showData = [];
		this.dataArray = [];
		const result = await this.helpCenterArticleService.findByCategoryId(id);
		if (result) {
			this.articleList = result;
			for (let i = 0; i < this.articleList.length; i++) {
				this.showData.push(false);
				this.dataArray.push(
					this.sanitizer.bypassSecurityTrustHtml(
						this.articleList[i].data
					)
				);
			}
		}
		this.filteredArticles = this.articleList;
		const res = await this.helpCenterAuthorService.getAll();
		if (res) {
			this.authors = res.items;
			for (const article of this.articleList) {
				const employeesList = [];
				this.authors.forEach((author) => {
					this.employees.forEach((employee) => {
						if (
							employee.id === author.employeeId &&
							author.articleId === article.id
						)
							employeesList.push(employee);
					});
				});
				article.employees = employeesList;
			}
		}
	}

	filterByName(item: string) {
		this.filterParams.name = item;
		this.isResetSelect = false;
		this.filterArticles();
	}

	onEmployeeSelected(authorId: string) {
		this.filterParams.authorId = authorId;
		this.isResetSelect = false;
		this.filterArticles();
	}

	filterArticles() {
		if (this.filterParams.name) {
			this.filteredArticles = this.articleList.filter((article) =>
				article.name
					.toLocaleLowerCase()
					.includes(this.filterParams.name.toLocaleLowerCase())
			);
		} else {
			this.filteredArticles = this.articleList;
		}
		const res = [];
		if (this.filterParams.authorId)
			this.articleList.forEach((article) => {
				article.employees.forEach((employee) => {
					if (employee.id === this.filterParams.authorId)
						res.push(article);
				});
				this.filteredArticles = res;
			});
	}

	clearFilters() {
		this.search.reset();
		this.isResetSelect = true;
		this.filterParams.name = '';
		this.filterParams.authorId = '';
		this.filteredArticles = this.articleList;
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
				length: this.articleList.length,
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
				article: this.articleList[i]
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
				article: this.articleList[i],
				editType: chosenType,
				length: this.articleList.length,
				id: this.categoryId
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('UPDATED');
			this.loadArticles(this.categoryId);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
