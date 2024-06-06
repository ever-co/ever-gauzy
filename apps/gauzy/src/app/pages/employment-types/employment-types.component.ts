import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import {
	IEmployee,
	IOrganization,
	IOrganizationEmploymentType,
	ITag,
	ComponentLayoutStyleEnum,
	EmploymentTypeTabsEnum
} from '@gauzy/contracts';
import { takeUntil } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { Store } from '@gauzy/ui-sdk/common';
import { OrganizationEmploymentTypesService } from '@gauzy/ui-sdk/core';
import { ComponentEnum } from '@gauzy/ui-sdk/common';
import { LocalDataSource } from 'angular2-smart-table';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Subject, firstValueFrom, filter, debounceTime, tap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IPaginationBase, PaginationFilterBaseComponent } from '@gauzy/ui-sdk/shared';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employment-types',
	templateUrl: './employment-types.component.html',
	styleUrls: ['./employment-types.component.scss']
})
export class EmploymentTypesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	@ViewChild('editableTemplate') public editableTemplateRef: TemplateRef<any>;
	form: UntypedFormGroup;
	selectedEmployee: IEmployee;
	organization: IOrganization;
	organizationEmploymentTypes: IOrganizationEmploymentType[] = [];
	tags: ITag[] = [];
	selectedOrgEmpType: IOrganizationEmploymentType;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	disabled: boolean = false;
	selected = {
		employmentType: null,
		state: false
	};
	employmentTypeExist: boolean;
	employmentTypeTabsEnum = EmploymentTypeTabsEnum;
	private _ngDestroy$ = new Subject<void>();
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private fb: UntypedFormBuilder,
		private readonly toastrService: ToastrService,
		private dialogService: NbDialogService,
		private store: Store,
		private organizationEmploymentTypesService: OrganizationEmploymentTypesService,
		readonly translateService: TranslateService,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.loadEmployeeTypes()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.openDialog(this.editableTemplateRef, false)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				tap(() => this.refreshPagination()),
				tap(() => (this.organizationEmploymentTypes = [])),
				untilDestroyed(this)
			)
			.subscribe();
		this._initializeForm();
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.cancel();
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private async loadEmployeeTypes() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { activePage, itemsPerPage } = this.getPagination();

		const res = await this.organizationEmploymentTypesService.getAllWithPagination(
			{
				organizationId,
				tenantId
			},
			['tags']
		);
		if (res) {
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.smartTableSource.load(res.items);
			if (this._isGridLayout) {
				this._loadGridLayoutData();
			} else this.organizationEmploymentTypes = res.items;
			if (this.organizationEmploymentTypes.length <= 0) {
				this.employmentTypeExist = false;
			} else {
				this.employmentTypeExist = true;
			}
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
			this.emptyListInvoke();
		}
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: ['', Validators.required]
		});
	}

	private get _isGridLayout(): boolean {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
	}

	private async _loadGridLayoutData() {
		this.organizationEmploymentTypes.push(...(await this.smartTableSource.getElements()));
	}

	async _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			pager: {
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			actions: false,
			columns: {
				tags: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}

	setView() {
		this.viewComponentName = ComponentEnum.EMPLOYMENT_TYPE;

		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap(() => this._refresh$.next(true)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedOrgEmpType = null;
			});
	}

	private async addEmploymentType() {
		if (!this.form.invalid) {
			const newEmploymentType = {
				name: this.form.get('name').value,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId,
				tags: this.tags
			};
			this.organizationEmploymentTypesService
				.addEmploymentType(newEmploymentType)
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe(() => {
					this._refresh$.next(true);
					this.subject$.next(true);
					this.cancel();
				});
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.ADD_EMPLOYMENT_TYPE', {
				name: this.form.get('name').value
			});
		} else {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.INVALID_EMPLOYMENT_TYPE',
				null,
				'TOASTR.MESSAGE.NEW_ORGANIZATION_INVALID_EMPLOYMENT_TYPE'
			);
		}
	}

	submitForm() {
		if (this.selectedOrgEmpType) {
			this.editOrgEmpType(this.selectedOrgEmpType.id, this.form.get('name').value);
		} else {
			this.addEmploymentType();
		}
	}

	async deleteEmploymentType(id, name) {
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'ORGANIZATIONS_PAGE.EMPLOYMENT_TYPE'
				}
			}).onClose
		);

		if (result) {
			await this.organizationEmploymentTypesService.deleteEmploymentType(id);
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.DELETE_EMPLOYMENT_TYPE',
				{
					name: name
				}
			);
			this.organizationEmploymentTypes = this.organizationEmploymentTypes.filter((t) => t['id'] !== id);

			this.emptyListInvoke();
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	cancel() {
		this.selectedOrgEmpType = null;
		this.selected = {
			employmentType: null,
			state: false
		};
		this.disabled = true;
		this.form.reset();
		this.tags = [];
	}

	async editOrgEmpType(id: string, name: string) {
		const orgEmpTypeForEdit = {
			name: name,
			tags: this.tags
		};
		await this.organizationEmploymentTypesService.editEmploymentType(id, orgEmpTypeForEdit);
		this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.UPDATE_EMPLOYMENT_TYPE', {
			name: name
		});
		this._refresh$.next(true);
		this.subject$.next(true);
		this.cancel();
	}
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(takeUntil(this._ngDestroy$)).subscribe(() => {
			this._loadSmartTableSettings();
		});
	}
	/*
	 * if empty employment types then displayed add button
	 */
	private emptyListInvoke() {
		if (this.organizationEmploymentTypes.length === 0) {
			this.cancel();
		}
	}

	edit(employmentType: IOrganizationEmploymentType) {
		this.selectedOrgEmpType = employmentType;
		this.tags = employmentType.tags;
		this.form.patchValue(employmentType);
	}

	openDialog(template: TemplateRef<any>, isEditTemplate: boolean) {
		try {
			isEditTemplate ? this.edit(this.selectedOrgEmpType) : this.cancel();
			this.dialogService.open(template);
		} catch (error) {
			console.log('An error occurred on open dialog');
		}
	}

	selectOrganizationEmploymentType(orgEmpType: any) {
		if (orgEmpType.data) orgEmpType = orgEmpType.data;
		const res =
			this.selected.employmentType && orgEmpType.id === this.selected.employmentType.id
				? { state: !this.selected.state }
				: { state: true };
		this.disabled = !res.state;
		this.selected.state = res.state;
		this.selected.employmentType = orgEmpType;
		this.selectedOrgEmpType = this.selected.employmentType;
	}
}
