import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
	Employee,
	Organization,
	OrganizationEmploymentType,
	Tag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';

@Component({
	selector: 'ga-employment-types',
	templateUrl: './employment-types.component.html'
})
export class EmploymentTypesComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	showAddCard: boolean;
	selectedEmployee: Employee;
	organization: Organization;
	organizationEmploymentTypes: OrganizationEmploymentType[];
	tags: Tag[] = [];
	showEditDiv: boolean = true;
	selectedOrgEmplType: OrganizationEmploymentType;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	constructor(
		private fb: FormBuilder,
		private readonly toastrService: NbToastrService,
		private store: Store,
		private organizationEmploymentTypesService: OrganizationEmploymentTypesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.showEditDiv = !this.showEditDiv;
		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: ['', Validators.required]
		});
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => {
				this.organization = data;
				if (this.organization) {
					this.organizationEmploymentTypesService
						.getAll(['tags'], {
							organizationId: this.organization.id
						})
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((types) => {
							this.organizationEmploymentTypes = types.items;
						});
				}
			});
	}

	private async onKeyEnter($event) {
		if ($event.code === 'Enter') {
			this.addEmploymentType($event.target.value);
		}
	}
	setView() {
		this.viewComponentName = ComponentEnum.EMPLOYMENT_TYPE;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}
	private async addEmploymentType(name: string) {
		if (name) {
			const newEmploymentType = {
				name,
				organizationId: this.organization.id,
				tags: this.tags
			};
			this.organizationEmploymentTypesService
				.addEmploymentType(newEmploymentType)
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((data) => {
					this.organizationEmploymentTypes.push(data);
				});
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.ADD_EMPLOYMENT_TYPE',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.showAddCard = !this.showAddCard;
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.INVALID_EMPLOYMENT_TYPE'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_INVALID_EMPLOYMENT_TYPE'
				)
			);
		}
	}

	submitForm() {
		const name = this.form.controls['name'].value;
		const newEmploymentType = {
			name,
			organizationId: this.organization.id,
			tags: this.tags
		};
		this.organizationEmploymentTypesService
			.addEmploymentType(newEmploymentType)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => {
				this.organizationEmploymentTypes.push(data);
			});
		this.form.reset();
	}

	async deleteEmploymentType(id, name) {
		await this.organizationEmploymentTypesService.deleteEmploymentType(id);
		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.DELETE_EMPLOYMENT_TYPE',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.organizationEmploymentTypes = this.organizationEmploymentTypes.filter(
			(t) => t['id'] !== id
		);
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	showEditCard(orgEmplType: OrganizationEmploymentType) {
		this.showEditDiv = true;
		this.selectedOrgEmplType = orgEmplType;
		this.tags = orgEmplType.tags;
	}

	cancel() {
		this.showEditDiv = !this.showEditDiv;
		this.selectedOrgEmplType = null;
	}

	async editOrgEmplType(id: string, name: string) {
		const orgEmplTypeForEdit = {
			name: name,
			tags: this.tags
		};

		await this.organizationEmploymentTypesService.editEmploymentType(
			id,
			orgEmplTypeForEdit
		);
		this._initializeForm();
		this.showEditDiv = !this.showEditDiv;
		this.tags = [];
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
