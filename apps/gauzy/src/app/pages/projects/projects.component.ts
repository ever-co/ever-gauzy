import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationProjectsCreateInput,
	PermissionsEnum,
	ComponentLayoutStyleEnum,
	CrudActionEnum,
	IEmployee
} from '@gauzy/contracts';
import {
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationProjectStore,
	Store,
	ToastrService
} from '../../@core/services';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import {
	ContactLinksComponent,
	DateViewComponent,
	PictureNameTagsComponent
} from '../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { HttpClient } from '@angular/common/http';
import { PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { distinctUntilChange } from 'packages/common-angular/dist';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-projects',
	templateUrl: './projects.component.html',
	styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy
{
	loading: boolean = false;
	settingsSmartTable: object;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	organization: IOrganization;
	showAddCard: boolean;
	projects: IOrganizationProject[] = [];
	organizationContacts: IOrganizationContact[] = [];
	projectToEdit: IOrganizationProject;
	viewPrivateProjects: boolean;
	disableButton = true;
	selectedProject: IOrganizationProject;
	smartTableSource: ServerDataSource;
	project$: Subject<any> = new Subject();

	projectsTable: Ng2SmartTableComponent;
	@ViewChild('projectsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.projectsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly organizationProjectStore: OrganizationProjectStore,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.project$
			.pipe(
				debounceTime(100),
				tap(() => (this.loading = true)),
				tap(() => this.loadProjects()),
				tap(() => this.loadOrganizationContacts()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
				tap(() => this.project$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.viewPrivateProjects = this.store.hasPermission(
					PermissionsEnum.ACCESS_PRIVATE_PROJECTS
				);
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.route.queryParamMap
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.showAddCard =
						params.get('openAddDialog') === 'true' ? true : false;
					this.project$.next(true);
				}
			});
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.project$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	ngOnDestroy() {}

	setView() {
		this.viewComponentName = ComponentEnum.PROJECTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.project$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async removeProject(id?: string, name?: string) {
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Project'
				}
			}).onClose
		);

		if (result) {
			await this.organizationProjectsService
				.delete(this.selectedProject ? this.selectedProject.id : id)
				.then(() => {
					this.organizationProjectStore.organizationProjectAction = {
						project: this.selectedProject,
						action: CrudActionEnum.DELETED
					};
				});

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.REMOVE_PROJECT',
				{
					name: this.selectedProject
						? this.selectedProject.name
						: name
				}
			);

			this.project$.next(true);
		}
	}

	cancel() {
		this.projectToEdit = null;
		this.showAddCard = false;

		this.selectProject({
			isSelected: false,
			data: null
		});
	}

	public async addOrEditProject({
		action,
		project
	}: {
		action: 'add' | 'edit';
		project: IOrganizationProjectsCreateInput;
	}) {
		switch (action) {
			case 'add':
				if (project.name) {
					await this.organizationProjectsService
						.create(project)
						.then((project: IOrganizationProject) => {
							this.organizationProjectStore.organizationProjectAction =
								{
									project,
									action: CrudActionEnum.CREATED
								};
						});
				} else {
					this.toastrService.danger(
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.INVALID_PROJECT_NAME'
						),
						this.getTranslation(
							'TOASTR.MESSAGE.NEW_ORGANIZATION_PROJECT_INVALID_NAME'
						)
					);
				}
				break;

			case 'edit':
				await this.organizationProjectsService
					.edit(project)
					.then((project: IOrganizationProject) => {
						this.organizationProjectStore.organizationProjectAction =
							{
								project,
								action: CrudActionEnum.UPDATED
							};
					});
				break;
		}

		this.toastrService.success(
			'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
			{
				name: project.name
			}
		);
		this.cancel();
		this.project$.next(true);
	}

	public setSmartTable() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/organization-projects/pagination`,
			relations: [
				'organizationContact',
				'members',
				'members.user',
				'tags'
			],
			where: { organizationId, tenantId },
			resultMap: (project: IOrganizationProject) => {
				return Object.assign({}, project, {
					...this.privatePublicProjectMapper(project)
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

	async loadProjects() {
		const { activePage, itemsPerPage } = this.getPagination();
		if (!this.organization) return;
		try {
			this.setSmartTable();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.loadGridLayoutData();
		} catch (error) {
			console.log(error);
		}
	}

	private async loadGridLayoutData() {
		if (this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID) {
			await this.smartTableSource.getElements();
			this.projects = this.smartTableSource.getData();
		}
	}

	private privatePublicProjectMapper(project: IOrganizationProject) {
		return this.viewPrivateProjects
			? project
			: project.public
			? project
			: project.members.map(
					(member: IEmployee) => member.id === this.store.userId
			  );
	}

	loadSmartTable() {
		const pagination = this.getPagination();
		this.settingsSmartTable = {
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			actions: false,
			pager: {
				display: false,
				perPage: pagination
					? this.pagination.itemsPerPage
					: this.minItemPerPage
			},
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				projectUrl: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.PROJECT_URL'
					),
					type: 'text'
				},
				organizationContact: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.CONTACT'
					),
					type: 'custom',
					class: 'text-center',
					renderComponent: ContactLinksComponent
				},
				startDate: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.START_DATE'
					),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					class: 'text-center'
				},
				endDate: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.END_DATE'
					),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					class: 'text-center'
				},
				billing: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.BILLING'
					),
					type: 'string',
					filter: false
				},
				currency: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.CURRENCY'
					),
					type: 'string',
					filter: false
				},
				owner: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.OWNER'),
					type: 'string',
					filter: false
				}
			}
		};
	}

	async selectProject({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProject = isSelected ? data : null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	private loadOrganizationContacts() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.organizationContactService
			.getAll(['projects'], {
				organizationId,
				tenantId
			})
			.then(({ items }) => {
				this.organizationContacts = items;
			});
	}

	async editProject(project: IOrganizationProject) {
		this.projectToEdit = project;
		this.showAddCard = true;
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.projectsTable.source.onChangedSource
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
		this.selectProject({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.projectsTable && this.projectsTable.grid) {
			this.projectsTable.grid.dataSet['willSelect'] = 'false';
			this.projectsTable.grid.dataSet.deselectAll();
		}
	}
}
