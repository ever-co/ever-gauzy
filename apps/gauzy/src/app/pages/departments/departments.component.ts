import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { debounceTime, firstValueFrom, Subject, combineLatest } from 'rxjs';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { EmployeeWithLinksComponent, NotesWithTagsComponent } from '../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { OrganizationDepartmentsService, Store, ToastrService } from '../../@core/services';
import { distinctUntilChange } from '@gauzy/common-angular';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { HttpClient } from '@angular/common/http';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { API_PREFIX } from '../../@core';
import { ActivatedRoute } from '@angular/router';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-departments',
	templateUrl: './departments.component.html',
	styleUrls: ['./departments.component.scss']
})
export class DepartmentsComponent extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	smartTableSettings: object;
	showAddCard: boolean;
	departments: IOrganizationDepartment[];
	employees: IEmployee[] = [];
	selectedDepartment: IOrganizationDepartment;
	disableButton: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	settingsSmartTable: object;
	loading: boolean;
	smartTableSource: ServerDataSource;

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
		private readonly httpClient: HttpClient,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.departments$
			.pipe(
				debounceTime(100),
				tap(() => this.getDepartments()),
				tap(() => this._clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.departments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		combineLatest([storeOrganization$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization]) => {
					this.organization = organization;					
				}),
				tap(() => this.refreshPagination()),
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
	
	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
			delete this.smartTableSettings['columns']['employeeName'];
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	selectDepartment({ isSelected, data }) {
		
		this.disableButton = !isSelected;
		this.selectedDepartment = isSelected ? data : null;
	}
	
	/**
	 * Load smart table columns settings
	 */
	private _loadSettingsSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
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
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.departments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
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
		this.selectDepartment({
			isSelected: true,
			data: department ? department : this.selectedDepartment
		});
		this.showAddCard = true;		
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

	/*
	* Register Smart Table Source Config
	*/
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/organization-department/pagination`,
			relations: [
				'members',
				'members.user',
				'tags'
			],
			join: {
				...(this.filters.join) ? this.filters.join : {}
			},
			where: {
				...{ organizationId, tenantId },
				...this.filters.where
			},
			resultMap: (department: IOrganizationDepartment) => {
				return department
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}
	
	private async getDepartments() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(
				activePage,
				itemsPerPage,
				false
			);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.departments = this.smartTableSource.getData();

				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			this.toastrService.danger('NOTES.EXPENSES.EXPENSES_ERROR', null, {
				error: error.error.message || error.message
			});
		}
	}

	/**
	 * On language change load smart table settings again
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSettingsSmartTable()),
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
				tap(() => this._clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	public _clearItem() {
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
