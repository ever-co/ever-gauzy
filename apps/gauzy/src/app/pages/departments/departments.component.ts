import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IEmployee,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from './../../@shared/language-base';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { EmployeeWithLinksComponent, NotesWithTagsComponent } from '../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { OrganizationDepartmentsService, Store, ToastrService } from '../../@core/services';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ActivatedRoute } from '@angular/router';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-departments',
	templateUrl: './departments.component.html',
	styleUrls: ['./departments.component.scss']
})
export class DepartmentsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	showAddCard: boolean;
	departments: IOrganizationDepartment[];
	employees: IEmployee[] = [];
	selectedDepartment: IOrganizationDepartment;
	disableButton: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	loading: boolean;

	departmentsTable: Ng2SmartTableComponent;
	@ViewChild('departmentsTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.departmentsTable = content;
			this._onChangedSource();
		}
	}

	public organization: IOrganization;
	departments$: Subject<any> = new Subject();

	constructor(
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.departments$
			.pipe(
				debounceTime(100),
				tap(() => this.loading = true),
				tap(() => this._loadDepartments()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.departments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
			this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.showAddCard = true),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() { }
	
	selectDepartment({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedDepartment = isSelected ? data : null;
	}
	
	/**
	 * Load smart table columns settings
	 */
	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string'
				},
				members: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS'),
					type: 'custom',
					renderComponent: EmployeeWithLinksComponent,
					filter: false
				},
				notes: {
					title: this.getTranslation('MENU.TAGS'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}

	setView() {
		this.viewComponentName = ComponentEnum.DEPARTMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedDepartment =
					this.dataLayoutStyle === 'CARDS_GRID'
						? null
						: this.selectedDepartment;
			});
	}

	async removeDepartment(id?: string, name?: string) {
		const result = await firstValueFrom(this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Department'
				}
			})
			.onClose);

		if (result) {
			await this.organizationDepartmentsService.delete(
				this.selectedDepartment ? this.selectedDepartment.id : id
			);
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.REMOVE_DEPARTMENT',
				{
					name: this.selectedDepartment
						? this.selectedDepartment.name
						: name
				}
			);
			this.departments$.next(true);
		}
	}

	async editDepartment(department: IOrganizationDepartment) {
		if (department) {
			this.selectDepartment({
				isSelected: true,
				data: department
			});
			this.showAddCard = true;
		}
	}

	public async addOrEditDepartment(input: IOrganizationDepartmentCreateInput) {
		if (input.name) {
			this.selectedDepartment
				? await this.organizationDepartmentsService.update(
					this.selectedDepartment.id,
					input
				)
				: await this.organizationDepartmentsService.create(input);
			
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.ADD_DEPARTMENT', {
				name: input.name
			});
			this.departments$.next(true);
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.INVALID_DEPARTMENT_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_DEPARTMENT_INVALID_NAME'
				)
			);
		}
	}

	private async _loadDepartments() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await this.organizationDepartmentsService.getAll(
			['members', 'members.user', 'tags'],
			{ organizationId, tenantId },
			{ createdAt: 'DESC' }
		).finally(() => {
			this.loading = false;
		});
		this.departments = items;
		this.smartTableSource.load(items);
	}
	
	/**
	 * On language change load smart table settings again
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	private _onChangedSource() {
		this.departmentsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	public clearItem() {
		this.showAddCard = false;
		this.selectDepartment({
			isSelected: false,
			data: null
		});
		this._deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	private _deselectAll() {
		if (this.departmentsTable && this.departmentsTable.grid) {
			this.departmentsTable.grid.dataSet['willSelect'] = 'false';
			this.departmentsTable.grid.dataSet.deselectAll();
		}
	}
}
