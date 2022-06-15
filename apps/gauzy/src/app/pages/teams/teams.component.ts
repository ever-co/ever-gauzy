import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	IEmployee,
	IOrganization,
	IOrganizationTeamCreateInput,
	IOrganizationTeam,
	ITag,
	RolesEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeesService, OrganizationTeamsService, Store, ToastrService } from '../../@core/services';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { EmployeeWithLinksComponent, NotesWithTagsComponent } from '../../@shared/table-components';
import { InputFilterComponent, TagsColorFilterComponent } from '../../@shared/table-filters';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { API_PREFIX } from '../../@core';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-teams',
	templateUrl: './teams.component.html',
	styleUrls: ['./teams.component.scss']
})
export class TeamsComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

	selectedTeam: IOrganizationTeam;
	
	showAddCard: boolean;
	disableButton: boolean = true;
	loading: boolean;
	
	teams: IOrganizationTeam[] = [];
	employees: IEmployee[] = [];
	tags: ITag[] = [];
	
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	
	smartTableSettings: object;
	smartTableSource: ServerDataSource;
	
	public organization: IOrganization;
	teams$: Subject<any> = new Subject();
	employees$: Subject<any> = new Subject();

	teamTable: Ng2SmartTableComponent;
	@ViewChild('teamTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.teamTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService,
		private readonly employeesService: EmployeesService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly httpClient: HttpClient,
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.teams$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
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
				tap(() => this.loadEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => this.organization = organization),
				tap(() => this.refreshPagination()),
				tap(() => this.teams$.next(true)),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				tap(() => this.showAddCard = true),
				tap(() => this.teams$.next(true)),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() { }

	setView() {
		this.viewComponentName = ComponentEnum.TEAMS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.teams$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();		
	}
	
	async addOrEditTeam(team: IOrganizationTeamCreateInput) {
		if (team.members.length) {
			if (this.selectedTeam) {
				try {
					await this.organizationTeamsService.update(
						this.selectedTeam.id,
						team
					);

					this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.EDIT_EXISTING_TEAM',
						{
							name: team.name
						}
					);

					this.teams$.next(true);
				} catch (error) {
					console.error(error);
				}

				this.showAddCard = false;
			} else {
				try {
					await this.organizationTeamsService.create(team);

					this.toastrService.success(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.ADD_NEW_TEAM',
						{
							name: team.name
						}
					);
					this.teams$.next(true);
				} catch (error) {
					console.error(error);
				}
			}
		} else {
			// TODO translate
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.INVALID_TEAM_NAME',
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_TEAM_INVALID_NAME'
				)
			);
		}

		this.showAddCard = false;
	}

	async removeTeam(id?: string, name?: string) {
		const result = await firstValueFrom(this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Team'
				}
			})
			.onClose);

		if (result) {
			try {
				await this.organizationTeamsService.delete(
					this.selectedTeam ? this.selectedTeam.id : id
				);

				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.REMOVE_TEAM',
					{
						name: this.selectedTeam
							? this.selectedTeam.name
							: name
					}
				);
				this.teams$.next(true);
			} catch (error) {
				console.error(error);
			}
		}
	}

	editTeam(selectedItem: IOrganizationTeam) {
		if (selectedItem) {
			this.selectTeam({
				isSelected: true,
				data: selectedItem
			});
		}
		
		this.showAddCard = true;
	}

	private async loadEmployees() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const { items } = await firstValueFrom(this.employeesService
			.getAll(['user', 'tags'], {
				organization: {
					id: organizationId
				},
				tenantId
			})
		);
		this.employees = items;
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
			relations: [
				'members',
				'members.role',
				'members.employee',
				'members.employee.user',
				'tags'
			],
			where: {
				...{ organizationId, tenantId },
				...this.filters.where
			},
			join: {
				alias: 'teams',
				leftJoin: {
					tags: 'teams.tags'
				}
			},			
			resultMap: (team: IOrganizationTeam) => {
				return Object.assign({}, team, {
					id: team.id,
					name: team.name,
					tags: team.tags,
					managers : team.members.filter(
						(member) => member.role && member.role.name === RolesEnum.MANAGER
					).map((item) => item.employee),
					members : team.members.filter((member) => !member.role).map((item) => item.employee)
				});
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

	async loadTeams() {
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
				await this._loadGridLayoutData();
			}			
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private async _loadGridLayoutData() {
		await this.smartTableSource.getElements();
		this.teams = this.smartTableSource.getData();

		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
	}

	selectTeam({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedTeam = isSelected ? data : null;
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
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
					filterFunction: (firstName: string) => {
						this.setFilter({ field: 'name', search: firstName });
					},
				},
				managers: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MANAGERS'),
					type: 'custom',
					renderComponent: EmployeeWithLinksComponent,
					filter: false
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
					renderComponent: NotesWithTagsComponent,
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
					},
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
	 * Table on changed source event
	 */
	onChangedSource() {
		this.teamTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.showAddCard = false;
		this.selectTeam({
			isSelected: false,
			data: null
		});		
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.teamTable && this.teamTable.grid) {
			this.teamTable.grid.dataSet['willSelect'] = 'false';
			this.teamTable.grid.dataSet.deselectAll();
		}
	}
}
