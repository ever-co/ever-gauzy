import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpStatusCode } from '@angular/common/http';
import {
	IEmployee,
	IOrganization,
	IOrganizationTeamCreateInput,
	IOrganizationTeam,
	ITag,
	RolesEnum,
	ComponentLayoutStyleEnum,
	ISelectedEmployee,
	IOrganizationProject,
	PermissionsEnum
} from '@gauzy/contracts';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Cell } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	EmployeesService,
	OrganizationProjectsService,
	OrganizationTeamsService,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	PaginationFilterBaseComponent,
	IPaginationBase,
	EmployeeWithLinksComponent,
	TagsOnlyComponent,
	DeleteConfirmationComponent,
	InputFilterComponent,
	TagsColorFilterComponent
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-teams',
    templateUrl: './teams.component.html',
    styleUrls: ['./teams.component.scss'],
    standalone: false
})
export class TeamsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	@ViewChild('addEditTemplate')
	addEditTemplate: TemplateRef<any>;
	addEditDialogRef: NbDialogRef<any>;
	selectedTeam: IOrganizationTeam;
	disableButton: boolean = true;
	loading: boolean;

	teams: IOrganizationTeam[] = [];
	employees: IEmployee[] = [];
	tags: ITag[] = [];
	projects: IOrganizationProject[] = [];

	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	smartTableSettings: object;
	smartTableSource: ServerDataSource;

	public selectedEmployeeId: ISelectedEmployee['id'];
	public organization: IOrganization;
	teams$: Subject<any> = this.subject$;
	employees$: Subject<any> = new Subject();
	projects$: Subject<any> = new Subject();

	selected = {
		team: null,
		state: false
	};
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService,
		private readonly employeesService: EmployeesService,
		private readonly projectService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.teams$
			.pipe(
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.loadTeams()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.teams$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.employees$
			.pipe(
				debounceTime(300),
				tap(() => this._refresh$.next(true)),
				tap(() => this.loadEmployees()),
				untilDestroyed(this)
			)
			.subscribe();

		this.projects$
			.pipe(
				debounceTime(300),
				tap(() => this._refresh$.next(true)),
				tap(() => this.loadOrganizationProjects()),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.teams$.next(true)),
				tap(() => this.employees$.next(true)),
				tap(() => this.projects$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				tap(() => this.teams$.next(true)),
				tap(() => this.employees$.next(true)),
				tap(() => this.projects$.next(true)),
				debounceTime(1000),
				tap(() => this.openDialog(this.addEditTemplate, false)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.teams = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}

	setView() {
		this.viewComponentName = ComponentEnum.TEAMS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.teams = [])),
				tap(() => this.teams$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async addOrEditTeam(team: IOrganizationTeamCreateInput) {
		if (this.selectedTeam) {
			try {
				const { id } = this.selectedTeam;
				const { id: organizationId } = this.organization;
				const { tenantId } = this.store.user;

				await this.organizationTeamsService.update(this.selectedTeam.id, {
					id,
					...team,
					organizationId,
					tenantId
				});

				this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.EDIT_EXISTING_TEAM', {
					name: team.name
				});
				this.clearItem();
				this._refresh$.next(true);
				this.teams$.next(true);
			} catch (error) {
				console.error(error);
			}
		} else {
			try {
				await this.organizationTeamsService.create(team);

				this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.ADD_NEW_TEAM', {
					name: team.name
				});
				this.clearItem();
				this._refresh$.next(true);
				this.teams$.next(true);
			} catch (error) {
				console.error(error);
			}
		}
	}

	async removeTeam(id?: string, name?: string) {
		if (!this.organization) {
			return;
		}

		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Team'
				}
			}).onClose
		);

		if (result) {
			try {
				const { id: organizationId, tenantId } = this.organization;
				const { id, name } = this.selectedTeam;

				const response = await this.organizationTeamsService.delete(id, {
					organizationId,
					tenantId
				});
				if ('status' in response && response.status === HttpStatusCode.Forbidden) {
					this.toastrService.error(response);
				} else {
					this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.REMOVE_TEAM', {
						name
					});
				}
			} catch (error) {
				console.error(error);
			} finally {
				this._refresh$.next(true);
				this.teams$.next(true);
			}
		}
	}

	editTeam(selectedItem: IOrganizationTeam) {
		if (selectedItem) {
			this.selected = {
				team: selectedItem,
				state: true
			};
		} else {
			this.selectedTeam = this.selected.team;
		}
	}

	private async loadEmployees() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const { items } = await firstValueFrom(
			this.employeesService.getAll(['user', 'tags'], {
				organizationId,
				tenantId
			})
		);
		this.employees = items;
	}

	/**
	 * load organization projects
	 *
	 * @returns
	 */
	private async loadOrganizationProjects(): Promise<IOrganizationProject[]> {
		if (
			!this.organization ||
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.projects = (
			await this.projectService.getAll([], {
				organizationId,
				tenantId
			})
		).items;
	}

	public getTagsByEmployeeId(id: string) {
		const employee = this.employees.find((empl) => empl.id === id);
		return employee ? employee.tags : [];
	}

	openEmployees(id) {
		this.router.navigate([`/pages/employees/edit/${id}`]);
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
			endPoint: `${API_PREFIX}/organization-team/pagination`,
			relations: ['members.role', 'members.employee.user', 'tags', 'projects'],
			join: {
				alias: 'organization_team',
				leftJoin: {
					tags: 'organization_team.tags'
				}
			},
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployeeId
					? {
							members: {
								employeeId: this.selectedEmployeeId
							}
					  }
					: {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (team: IOrganizationTeam) => {
				return Object.assign({}, team, {
					id: team.id,
					name: team.name,
					tags: team.tags,
					managers: team.members
						.filter((member) => member.role && member.role.name === RolesEnum.MANAGER)
						.map((item) => item.employee),
					members: team.members.filter((member) => !member.role).map((item) => item.employee)
				});
			},
			finalize: () => {
				if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID)
					this.teams.push(...this.smartTableSource.getData());
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	async loadTeams() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			this.setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this._loadGridLayoutData();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private async _loadGridLayoutData() {
		await this.smartTableSource.getElements();
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
	}

	selectTeam(team: any) {
		if (team.data) team = team.data;
		const res =
			this.selected.team && team.id === this.selected.team.id ? { state: !this.selected.state } : { state: true };
		this.disableButton = !res.state;
		this.selected.state = res.state;
		this.selected.team = team;
		this.selectedTeam = this.selected.team;
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.TEAM'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.NAME'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (firstName: string) => {
						this.setFilter({ field: 'name', search: firstName });
					}
				},
				managers: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MANAGERS'),
					type: 'custom',
					isFilterable: false,
					renderComponent: EmployeeWithLinksComponent,
					componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				members: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS'),
					type: 'custom',
					isFilterable: false,
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
					renderComponent: TagsOnlyComponent,
					componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
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

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selected = {
			team: null,
			state: false
		};
		this.selectedTeam = null;
		this.disableButton = true;
		this.addEditDialogRef?.close();
	}

	openDialog(template: TemplateRef<any>, isEditTemplate: boolean) {
		try {
			isEditTemplate ? this.editTeam(this.selectedTeam) : this.clearItem();
			this.addEditDialogRef = this.dialogService.open(template);
		} catch (error) {
			console.log('An error occurred on open dialog');
		}
	}
}
