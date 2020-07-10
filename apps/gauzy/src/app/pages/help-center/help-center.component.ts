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
	public selectedEmployeeIds = null;
	public search: FormControl = new FormControl();
	public categoryName = '';
	public categoryId = '';
	public authors: IHelpCenterAuthor[] = [];

	ngOnInit() {
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
		this.search.valueChanges.subscribe((item) => console.log(item));
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

		const res = await this.helpCenterAuthorService.getAll();
		if (res) {
			this.authors = res.items;
		}

		this.loadEmployee();
	}

	async loadEmployee() {
		for (const article of this.articleList) {
			const employeesList = [];
			for (const author of this.authors) {
				const res = await this.employeeService.getEmployeeById(
					author.employeeId,
					['user']
				);
				if (
					res &&
					author.employeeId === res.id &&
					author.articleId === article.id
				)
					employeesList.push(res);
			}
			article.employees = employeesList;
		}
	}

	onEmployeeSelected(event: string[]) {
		this.selectedEmployeeIds = event;
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
