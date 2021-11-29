import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeesService, OrganizationTeamsService, Store, ToastrService } from '../../@core/services';
import { TranslationBaseComponent } from '../../@shared/language-base';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { EmployeeWithLinksComponent, NotesWithTagsComponent } from '../../@shared/table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-teams',
	templateUrl: './teams.component.html',
	styleUrls: ['./teams.component.scss']
})
export class TeamsComponent
	extends TranslationBaseComponent
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
	
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	
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
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	async ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.teams$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.loadTeams()),
				tap(() => this.clearItem()),
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
				tap(() => this.teams$.next(true)),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				tap(() => this.showAddCard = !this.showAddCard),
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
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				tap(() => this.clearItem()),
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
		console.log(this.selectedTeam);
		this.showAddCard = true;
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
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

	async loadTeams() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const { items: teams } = await this.organizationTeamsService.getAll(
			[
				'members',
				'members.role',
				'members.employee',
				'members.employee.user',
				'tags'
			],
			{ organizationId, tenantId }
		);
		if (teams) {
			teams.forEach((team: IOrganizationTeam) => {
				team.managers = team.members.filter(
					(member) => member.role && member.role.name === RolesEnum.MANAGER
				);
				team.members = team.members.filter((member) => !member.role);
			});

			this.teams = [...teams].sort(
				(a, b) => b.members.length - a.members.length
			).map((team) =>{
				return {
					id: team.id,
					name: team.name,
					members: team.members.map((item) => item.employee),
					managers: team.managers.map((item) => item.employee),
					tags: team.tags
				}
			});
			console.log(this.teams);
			this.smartTableSource.load(this.teams);
		}
		this.loading = false;
	}

	selectTeam({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedTeam = isSelected ? data : null;
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string'
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
					renderComponent: NotesWithTagsComponent
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
		this.selectTeam({
			isSelected: false,
			data: null
		});
		this.deselectAll();
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
