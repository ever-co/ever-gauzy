import { IHelpCenterArticle, IHelpCenter, IHelpCenterAuthor, IEmployee, IOrganization } from '@gauzy/contracts';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { AddArticleComponent } from './add-article/add-article.component';
import { NbDialogService } from '@nebular/theme';
import { DeleteArticleComponent } from './delete-article/delete-article.component';
import { HelpCenterArticleService, HelpCenterAuthorService, ToastrService } from '@gauzy/ui-core/core';
import { filter } from 'rxjs/operators';
import { EmployeesService } from '@gauzy/ui-core/core';
import { FormControl } from '@angular/forms';
import { Store } from '@gauzy/ui-core/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule, SidebarModule, EmployeeMultiSelectModule, UserFormsModule } from '@gauzy/ui-core/shared';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-help-center',
	templateUrl: './help-center.component.html',
	styleUrls: ['./help-center.component.scss'],
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		SharedModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbTooltipModule,
		NbSpinnerModule,
		TranslateModule,
		SidebarModule,
		EmployeeMultiSelectModule,
		UserFormsModule,
		NgxPermissionsModule
	]
})
export class HelpCenterComponent extends TranslationBaseComponent implements OnDestroy, OnInit {
	constructor(
		private readonly dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private helpCenterArticleService: HelpCenterArticleService,
		private readonly toastrService: ToastrService,
		private helpCenterAuthorService: HelpCenterAuthorService,
		private employeeService: EmployeesService,
		private readonly store: Store,
		private sanitizer: DomSanitizer
	) {
		super(translateService);
	}

	public expandedArticles: Set<string> = new Set();
	public articleContent: Map<string, SafeHtml | string> = new Map();
	public employees: IEmployee[] = [];
	public articleList: IHelpCenterArticle[] = [];
	public isResetSelect = false;
	public filteredArticles: IHelpCenterArticle[] = [];
	public search: FormControl = new FormControl();
	public categoryName = '';
	public categoryId = '';
	public authors: IHelpCenterAuthor[] = [];
	filterParams = { name: '', authorId: '' };
	loading: boolean;
	organization: IOrganization;
	selectedItem = {
		isSelected: false,
		article: null
	};
	isDisable: boolean = true;

	public showFilters: boolean = false;

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					const { tenantId } = this.store.user;
					const { id: organizationId } = organization;
					this.organization = organization;
					this.employeeService
						.getAll(['user'], { organizationId, tenantId })
						.pipe(untilDestroyed(this))
						.subscribe((employees) => {
							this.employees = employees.items;
						});
				}
			});
		this.search.valueChanges.pipe(untilDestroyed(this)).subscribe((item) => {
			this.filterByName(item);
		});
	}

	clickedNode(clickedNode: IHelpCenter) {
		this.categoryId = clickedNode.id;
		this.categoryName = clickedNode.flag === 'category' ? clickedNode.name : '';
		this.loadArticles(this.categoryId);
	}

	openArticle(article: IHelpCenterArticle) {
		if (this.expandedArticles.has(article.id)) {
			this.expandedArticles.delete(article.id);
		} else {
			this.expandedArticles.add(article.id);
		}
	}

	deletedNode() {
		this.categoryId = '';
		this.categoryName = '';
		this.loadArticles('id');
	}

	async loadArticles(id) {
		this.loading = true;
		this.expandedArticles.clear();
		this.articleContent.clear();
		const result = await this.helpCenterArticleService.findByCategoryId(id);
		if (result) {
			this.articleList = result;
			for (const article of this.articleList) {
				if (article.data) {
					this.articleContent.set(article.id, this.sanitizer.bypassSecurityTrustHtml(article.data));
				}
			}
		}
		this.filteredArticles = this.articleList;
		const { id: organizationId, tenantId } = this.organization;
		const res = await this.helpCenterAuthorService.getAll([], {
			organizationId,
			tenantId
		});
		if (res) {
			this.authors = res.items;
			for (const article of this.articleList) {
				const employeesList = [];
				this.authors.forEach((author) => {
					this.employees.forEach((employee) => {
						if (employee.id === author.employeeId && author.articleId === article.id)
							employeesList.push(employee);
					});
				});
				article.employees = employeesList;
			}
			this.loading = false;
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
		if (!this.filterParams.authorId && this.filterParams.name)
			this.filteredArticles = this.articleList.filter((article) =>
				article.name.toLocaleLowerCase().includes(this.filterParams.name.toLocaleLowerCase())
			);
		if (!this.filterParams.authorId && !this.filterParams.name) this.filteredArticles = this.articleList;
		const res = [];
		if (this.filterParams.authorId && !this.filterParams.name)
			this.articleList.forEach((article) => {
				article.employees.forEach((employee) => {
					if (employee.id === this.filterParams.authorId) res.push(article);
				});
				this.filteredArticles = res;
			});
		if (this.filterParams.authorId && this.filterParams.name) {
			this.filteredArticles = this.articleList.filter((article) =>
				article.name.toLocaleLowerCase().includes(this.filterParams.name.toLocaleLowerCase())
			);
			this.filteredArticles.forEach((article) => {
				article.employees.forEach((employee) => {
					if (employee.id === this.filterParams.authorId) res.push(article);
				});
				this.filteredArticles = res;
			});
		}
	}

	clearFilters() {
		this.search.reset();
		this.isResetSelect = true;
		this.filterParams.name = '';
		this.filterParams.authorId = '';
		this.filteredArticles = this.articleList;
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
		const data = await firstValueFrom(dialog.onClose);

		if (data) {
			this.toastrService.success('TOASTR.MESSAGE.HELP_ARTICLE_CREATED');
			this.loadArticles(this.categoryId);
		}
	}

	async deleteNode(article: IHelpCenterArticle) {
		const dialog = this.dialogService.open(DeleteArticleComponent, {
			context: {
				article: article
			}
		});
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrService.success('TOASTR.MESSAGE.HELP_ARTICLE_DELETED', {
				name: data.name
			});
			this.loadArticles(this.categoryId);
		}
	}

	async editNode(article: IHelpCenterArticle) {
		const chosenType = 'edit';
		const dialog = this.dialogService.open(AddArticleComponent, {
			context: {
				article: article,
				editType: chosenType,
				length: this.articleList.length,
				id: this.categoryId
			}
		});
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrService.success('TOASTR.MESSAGE.HELP_ARTICLE_UPDATED', {
				name: data.name
			});
			this.loadArticles(this.categoryId);
		}
	}

	selectItem(article: IHelpCenterArticle) {
		this.selectedItem = this.isSelected(article)
			? {
					isSelected: false,
					article: null
			  }
			: {
					isSelected: true,
					article: article
			  };
		this.isDisable = !this.selectedItem.isSelected;
	}

	isSelected(article: IHelpCenterArticle): boolean {
		return !!(
			this.selectedItem.isSelected &&
			this.selectedItem.article &&
			article.id === this.selectedItem.article.id
		);
	}

	ngOnDestroy() {}
}
