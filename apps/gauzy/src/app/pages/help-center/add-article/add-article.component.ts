import { IHelpCenterArticle, Employee, IHelpCenterAuthor } from '@gauzy/models';
import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';
import { EmployeesService } from '../../../@core/services';
import { takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { HelpCenterAuthorService } from '../../../@core/services/help-center-author.service';

@Component({
	selector: 'ga-add-article',
	templateUrl: 'add-article.component.html',
	styleUrls: ['add-article.component.scss']
})
export class AddArticleComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() article?: IHelpCenterArticle;
	@Input() editType: string;
	@Input() length: number;
	@Input() id: string;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<AddArticleComponent>,
		readonly translateService: TranslateService,
		private readonly fb: FormBuilder,
		private errorHandler: ErrorHandlingService,
		private employeeService: EmployeesService,
		private helpCenterAuthorService: HelpCenterAuthorService,
		private helpCenterArticleService: HelpCenterArticleService
	) {
		super(translateService);
	}
	form: FormGroup;
	public data = {
		name: '',
		description: '',
		data: '',
		valid: null
	};
	public selectedPrivacy = false;
	public selectedStatus = false;
	employees: Employee[];
	authors: IHelpCenterAuthor[];
	selectedEmployeeIds = null;
	employeeIds: string[] = [];

	ngOnInit() {
		this.form = this.fb.group({
			name: ['', Validators.required],
			desc: ['', Validators.required],
			data: ['', Validators.required],
			valid: [null, Validators.required]
		});
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});

		if (this.editType === 'add') this.loadFormData(this.data);
		if (this.editType === 'edit') {
			this.loadFormData(this.article);
			this.selectedPrivacy = this.article.privacy;
			this.selectedStatus = this.article.draft;
			this.loadAuthors(this.article.id);
			// this.article.authors.forEach((author) => this.employeeIds.push(author));
		}
	}

	onMembersSelected(event: string[]) {
		this.selectedEmployeeIds = event;
		const value = this.selectedEmployeeIds[0] ? true : null;
		this.form.patchValue({
			valid: value
		});
	}

	async loadAuthors(id) {
		try {
			this.authors = await this.helpCenterAuthorService.findByArticleId(
				id
			);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	toggleStatus(event: boolean) {
		this.selectedStatus = event;
	}

	togglePrivacy(event: boolean) {
		this.selectedPrivacy = event;
	}

	loadFormData(data) {
		this.form.patchValue({
			name: data.name,
			desc: data.description,
			data: data.data,
			valid: null
		});
	}

	async submit() {
		if (this.editType === 'add')
			try {
				this.article = await this.helpCenterArticleService.create({
					name: '',
					description: '',
					data: '',
					draft: false,
					privacy: false,
					index: this.length,
					categoryId: this.id
				});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		// this.addAuthors(this.article.id, this.selectedEmployeeIds);
		try {
			this.article = await this.helpCenterArticleService.update(
				`${this.article.id}`,
				{
					name: `${this.form.value.name}`,
					description: `${this.form.value.desc}`,
					data: `${this.form.value.data}`,
					draft: this.selectedStatus,
					privacy: this.selectedPrivacy
				}
			);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		this.dialogRef.close(this.article);
	}

	async addAuthors(articleId: string, employeeIds: string[]) {
		try {
			await this.helpCenterAuthorService.createBulk(
				articleId,
				employeeIds
			);
		} catch (error) {
			this.errorHandler.handleError(error);
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
