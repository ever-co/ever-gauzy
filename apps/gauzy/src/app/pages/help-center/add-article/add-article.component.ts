import { IHelpCenterArticle, IEmployee, IHelpCenterAuthor, IOrganization } from '@gauzy/contracts';
import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { ckEditorConfig } from '@gauzy/ui-sdk/shared';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ErrorHandlingService } from '@gauzy/ui-sdk/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';
import { EmployeesService } from '../../../@core/services';
import { takeUntil } from 'rxjs/operators';
import { HelpCenterAuthorService } from '../../../@core/services/help-center-author.service';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ga-add-article',
	templateUrl: 'add-article.component.html',
	styleUrls: ['add-article.component.scss']
})
export class AddArticleComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() article?: IHelpCenterArticle;
	@Input() editType: string;
	@Input() length: number;
	@Input() id: string;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<AddArticleComponent>,
		readonly translateService: TranslateService,
		private readonly fb: UntypedFormBuilder,
		private errorHandler: ErrorHandlingService,
		private employeeService: EmployeesService,
		private helpCenterAuthorService: HelpCenterAuthorService,
		private helpCenterArticleService: HelpCenterArticleService,
		private readonly store: Store
	) {
		super(translateService);
	}
	form: UntypedFormGroup;
	public data = {
		name: '',
		description: '',
		data: '',
		valid: null
	};
	public selectedPrivacy = false;
	public selectedStatus = false;
	public membersChanged = false;
	employees: IEmployee[];
	authors: IHelpCenterAuthor[];
	selectedEmployeeIds = null;
	employeeIds: string[] = [];
	organization: IOrganization;
	ckConfig: CKEditor4.Config = {
		...ckEditorConfig,
		height: '100'
	};

	ngOnInit() {
		this.organization = this.store.selectedOrganization;
		this.form = this.fb.group({
			name: ['', Validators.compose([Validators.required, Validators.maxLength(255)])],
			desc: ['', Validators.compose([Validators.required, Validators.maxLength(255)])],
			data: ['', Validators.required],
			valid: [null, Validators.required]
		});
		const { id: organizationId, tenantId } = this.organization;
		this.employeeService
			.getAll(['user'], { organizationId, tenantId })
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
		}
	}

	onMembersSelected(event: string[]) {
		this.membersChanged = true;
		this.selectedEmployeeIds = event;
		const value = this.selectedEmployeeIds[0] ? true : null;
		this.form.patchValue({
			valid: value
		});
	}

	async loadAuthors(id) {
		try {
			this.authors = await this.helpCenterAuthorService.findByArticleId(id);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		this.employeeIds = this.authors ? this.authors.map((item) => item.employeeId) : [];
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
			valid: this.editType === 'add' ? data.valid : data.name
		});
	}

	async submit() {
		const { id: organizationId, tenantId } = this.organization;
		if (this.editType === 'add') {
			try {
				this.article = await this.helpCenterArticleService.create({
					name: '',
					description: '',
					data: '',
					draft: false,
					privacy: false,
					index: this.length,
					categoryId: this.id,
					organizationId,
					tenantId
				});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
		if (this.membersChanged) {
			if (this.editType === 'edit') this.deleteAuthors(this.article.id);
			this.addAuthors(this.article.id, this.selectedEmployeeIds);
			try {
				this.article = await this.helpCenterArticleService.update(`${this.article.id}`, {
					name: `${this.form.value.name}`,
					description: `${this.form.value.desc}`,
					data: `${this.form.value.data}`,
					draft: this.selectedStatus,
					privacy: this.selectedPrivacy
				});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
		this.dialogRef.close(this.article);
	}

	async addAuthors(articleId: string, employeeIds: string[]) {
		try {
			const { id: organizationId, tenantId } = this.organization;
			await this.helpCenterAuthorService.createBulk({
				organizationId,
				tenantId,
				articleId,
				employeeIds
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async deleteAuthors(articleId: string) {
		try {
			await this.helpCenterAuthorService.deleteBulkByArticleId(articleId);
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

	public get name(): AbstractControl {
		return this.form.get('name');
	}

	public get desc(): AbstractControl {
		return this.form.get('desc');
	}
}
