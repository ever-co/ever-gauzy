import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { Cell } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';
import {
	IEmployee,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	ComponentLayoutStyleEnum,
	IOrganization,
	ITag
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { EmployeeWithLinksComponent, NotesWithTagsComponent } from '../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { OrganizationDepartmentsService, Store } from '../../@core/services';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';
import { InputFilterComponent, TagsColorFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-departments',
	templateUrl: './departments.component.html',
	styleUrls: ['./departments.component.scss']
})
export class DepartmentsComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	@ViewChild('addEditTemplate')
	addEditTemplate: TemplateRef<any>;
	addEditDialogRef: NbDialogRef<any>;
	smartTableSettings: object;
	departments: IOrganizationDepartment[];
	employees: IEmployee[] = [];
	selectedDepartment: IOrganizationDepartment;
	disableButton: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	settingsSmartTable: object;
	loading: boolean = false;
	smartTableSource: ServerDataSource;
	selected = {
		department: null,
		state: false
	};

	public organization: IOrganization;
	public departments$: Subject<boolean> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

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
				tap(() => this._clearItem()),
				tap(() => this.getDepartments()),
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
		this.store.selectedOrganization$
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.departments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.openDialog(this.addEditTemplate, false)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.departments = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}

	ngAfterViewInit() {}

	selectDepartment(department: any) {
		if (department.data) department = department.data;
		const res =
			this.selected.department && department.id === this.selected.department.id
				? { state: !this.selected.state }
				: { state: true };
		this.disableButton = !res.state;
		this.selected.state = res.state;
		this.selected.department = department;
		this.selectedDepartment = this.selected.department;
	}

	/**
	 * Load smart table columns settings
	 */
	private _loadSettingsSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.DEPARTMENT'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (name: string) => {
						this.setFilter({ field: 'name', search: name });
					}
				},
				members: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS'),
					type: 'custom',
					filter: false,
					renderComponent: EmployeeWithLinksComponent,
					componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				notes: {
					title: this.getTranslation('MENU.TAGS'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent,
					componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					},
					filter: {
						type: 'custom',
						component: TagsColorFilterComponent
					},
					filterFunction: (tags: ITag[]) => {
						const tagIds = [];
						for (const tag of tags) {
							tagIds.push(tag.id);
						}
						this.setFilter({ field: 'tags', search: tagIds });
					}
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
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.departments = [])),
				tap(() => this.departments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async removeDepartment(id?: string, name?: string) {
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Department'
				}
			}).onClose
		);

		if (result) {
			await this.organizationDepartmentsService.delete(this.selectedDepartment ? this.selectedDepartment.id : id);
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.REMOVE_DEPARTMENT', {
				name: this.selectedDepartment ? this.selectedDepartment.name : name
			});
			this._refresh$.next(true);
			this.departments$.next(true);
		}
	}

	async editDepartment(selectedItem: IOrganizationDepartment) {
		if (selectedItem) {
			this.selected = {
				department: selectedItem,
				state: true
			};
		} else {
			this.selectedDepartment = this.selected.department;
		}
	}

	public async addOrEditDepartment(input: IOrganizationDepartmentCreateInput) {
		if (input.name) {
			this.selectedDepartment
				? await this.organizationDepartmentsService.update(this.selectedDepartment.id, input)
				: await this.organizationDepartmentsService.create(input);

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.ADD_DEPARTMENT', {
				name: input.name
			});
			this._refresh$.next(true);
			this.departments$.next(true);
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.INVALID_DEPARTMENT_NAME'),
				this.getTranslation('TOASTR.MESSAGE.NEW_ORGANIZATION_DEPARTMENT_INVALID_NAME')
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
			relations: ['members', 'members.user', 'tags'],
			join: {
				alias: 'organization_department',
				leftJoin: {
					tags: 'organization_department.tags'
				},
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				tenantId,
				organizationId,
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (department: IOrganizationDepartment) => {
				return department;
			},
			finalize: () => {
				if (this._isGridLayout) this.departments.push(...this.smartTableSource.getData());
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
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			if (this._isGridLayout) {
				await this.smartTableSource.getElements();
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private get _isGridLayout(): boolean {
		return this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID;
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
	 * Clear selected item
	 */
	public _clearItem() {
		this.selected = {
			department: null,
			state: false
		};
		this.selectedDepartment = null;
		this.disableButton = true;
		this.addEditDialogRef?.close();
	}

	openDialog(template: TemplateRef<any>, isEditTemplate: boolean) {
		try {
			isEditTemplate ? this.editDepartment(this.selectedDepartment) : this._clearItem();
			this.addEditDialogRef = this.dialogService.open(template);
		} catch (error) {
			console.log('An error occurred on open dialog');
		}
	}
}
