import {
	Component,
	Input,
	OnDestroy,
	OnInit,
	AfterViewInit
} from '@angular/core';
import {
	NbMenuService,
	NbSidebarService,
	NbThemeService,
	NbMenuItem
} from '@nebular/theme';
import { LayoutService } from '../../../@core/utils';
import { Router, NavigationEnd } from '@angular/router';
import { debounceTime, filter, first } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services/store.service';
import {
	CrudActionEnum,
	IOrganization,
	PermissionsEnum,
	TimeLogType
} from '@gauzy/contracts';
import { IUser } from '@gauzy/contracts';
import { TimeTrackerService } from '../../../@shared/time-tracker/time-tracker.service';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '../../../../environments/environment';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { NO_EMPLOYEE_SELECTED } from './selectors/employee';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import {
	EmployeeStore,
	ISidebarActionConfig,
	NavigationBuilderService,
	OrganizationEditStore,
	OrganizationProjectStore
} from '../../../@core/services';
import {
	DEFAULT_SELECTOR_VISIBILITY,
	ISelectorVisibility,
	SelectorBuilderService
} from '../../../@core/services';
import { combineLatest, Subject } from 'rxjs';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-header',
	styleUrls: ['./header.component.scss'],
	templateUrl: './header.component.html'
})
export class HeaderComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	hasPermissionE = false;
	hasPermissionI = false;
	hasPermissionP = false;
	hasPermissionIn = false;
	hasPermissionIEdit = false;
	hasPermissionEEdit = false;
	hasPermissionPEdit = false;
	hasPermissionInEdit = false;
	hasPermissionTask = false;
	hasPermissionEmpEdit = false;
	hasPermissionProjEdit = false;
	hasPermissionContactEdit = false;
	hasPermissionTeamEdit = false;
	hasPermissionContractEdit = false;
	hasPermissionPaymentAddEdit = false;
	hasPermissionTimesheetEdit = false;
	hasPermissionCandidateEdit = false;
	isEmployee = false;
	isElectron: boolean = environment.IS_ELECTRON;

	@Input() position = 'normal';
	user: IUser;

	showEmployeesSelector: boolean;
	showOrganizationsSelector: boolean;
	showProjectsSelector: boolean;

	showDateSelector = true;
	theme: string;
	createContextMenu: NbMenuItem[];
	supportContextMenu: NbMenuItem[];
	showExtraActions = false;
	actions = {
		START_TIMER: 'START_TIMER'
	};
	timerDuration: string;
	organization: IOrganization;
	selectedDate: Date;

	subject$: Subject<any> = new Subject();
	selectorsVisibility: ISelectorVisibility;

	constructor(
		private readonly sidebarService: NbSidebarService,
		private readonly menuService: NbMenuService,
		private readonly layoutService: LayoutService,
		private readonly themeService: NbThemeService,
		private readonly router: Router,
		public readonly translate: TranslateService,
		private readonly store: Store,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly usersOrganizationsService: UsersOrganizationsService,
		private readonly organizationsService: OrganizationsService,
		private readonly employeesService: EmployeesService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		public readonly navigationBuilderService: NavigationBuilderService,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly organizationProjectStore: OrganizationProjectStore,
		private readonly employeeStore: EmployeeStore,
		public readonly selectorBuilderService: SelectorBuilderService
	) {
		super(translate);
	}

	ngOnInit() {
		this.selectorBuilderService.selectors$
			.pipe(untilDestroyed(this))
			.subscribe((selectors) => {
				this.selectorsVisibility = Object.assign(
					{},
					DEFAULT_SELECTOR_VISIBILITY,
					selectors
				);
			});
		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.timeTrackerService.showTimerWindow = false;
			});
		this.timeTrackerService.duration$
			.pipe(untilDestroyed(this))
			.subscribe((time) => {
				if (!isNaN(time)) {
					this.timerDuration = moment
						.utc(time * 1000)
						.format('HH:mm:ss');
				}
			});
		this.menuService
			.onItemClick()
			.pipe(
				filter(({ tag }) => tag === 'create-context-menu'),
				untilDestroyed(this)
			)
			.subscribe((e) => {
				if (e.item.data && e.item.data.action) {
					switch (e.item.data.action) {
						case this.actions.START_TIMER:
							this.timeTrackerService.setTimeLogType(
								TimeLogType.TRACKED
							);
							this.timeTrackerService.openAndStartTimer();
							break;
					}
					return; //If action is given then do not navigate
				}
				this.router.navigate([e.item.link], {
					queryParams: {
						openAddDialog: true
					}
				});
			});
		this.store.user$
			.pipe(
				filter((user) => !!user),
				untilDestroyed(this)
			)
			.subscribe(async (user) => {
				this.user = user;
				this.isEmployee = !!user && !!user.employeeId;
				//check header selectors dropdown permissions
				await this.checkOrganizationSelectorVisibility();
				//check timer status for employee
				if (this.isEmployee) {
					this._checkTimerStatus();
				}
			});
		this.subject$
			.pipe(debounceTime(1300), untilDestroyed(this))
			.subscribe(() => {
				this.checkEmployeeSelectorVisibility();
				this.checkProjectSelectorVisibility();
				this.loadItems();
			});
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDate$ = this.store.selectedDate$;
		combineLatest([storeOrganization$, selectedDate$])
			.pipe(
				filter(([organization, date]) => !!organization && !!date),
				untilDestroyed(this)
			)
			.subscribe(([organization, date]) => {
				this.organization = organization;
				this.selectedDate = date;
				this.subject$.next();
			});
		this.themeService
			.onThemeChange()
			.pipe(untilDestroyed(this))
			.subscribe((t) => {
				this.theme = t.name;
			});
		this._applyTranslationOnSmartTable();
		this.loadItems();
	}

	checkProjectSelectorVisibility() {
		// hidden project selector if not activate for current page
		if (!this.organization || !this.selectorsVisibility.project) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		this.organizationProjectsService
			.getCount([], {
				organizationId,
				tenantId
			})
			.then((count) => {
				this.showProjectsSelector = count > 0;
			});
	}

	checkEmployeeSelectorVisibility() {
		// hidden employee selector if not activate for current page
		if (!this.organization || !this.selectorsVisibility.employee) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		this.employeesService
			.getWorkingCount(organizationId, tenantId, this.selectedDate, true)
			.then(async ({ total: employeeCount }) => {
				if (
					this.store.hasPermission(
						PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
					)
				) {
					this.showEmployeesSelector = employeeCount > 0;
					this.store.selectedEmployee = null;
				} else {
					const emp = await this.employeesService.getEmployeeById(
						this.user.employeeId,
						[]
					);
					if (emp) {
						this.store.selectedEmployee = {
							id: emp.id,
							firstName: this.user.firstName,
							lastName: this.user.lastName,
							imageUrl: this.user.imageUrl
						};
					} else {
						this.store.selectedEmployee = NO_EMPLOYEE_SELECTED;
					}
				}
			});
	}

	async checkOrganizationSelectorVisibility() {
		// hidden organization selector if not activate for current page
		if (!this.selectorsVisibility.organization) {
			return;
		}

		const { userId } = this.store;
		const { tenantId } = this.store.user;
		const { items: userOrg } = await this.usersOrganizationsService.getAll(
			[],
			{
				userId,
				tenantId
			}
		);

		if (
			this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_ORGANIZATION
			) && 
			userOrg.length > 1
		) {
			this.showOrganizationsSelector = true;
		} else {
			if (userOrg.length > 0) {
				const [firstUserOrg] = userOrg;
				const org = await this.organizationsService
					.getById(firstUserOrg.organizationId)
					.pipe(first())
					.toPromise();
				this.store.selectedOrganization = org;
			}
		}
	}

	ngAfterViewInit(): void {
		this.organizationEditStore.organizationAction$
			.pipe(
				filter(({ organization }) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(({ action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
					case CrudActionEnum.UPDATED:
					case CrudActionEnum.DELETED:
						this.checkOrganizationSelectorVisibility();
						break;
				}
			});
		this.organizationProjectStore.organizationProjectAction$
			.pipe(
				filter(({ project, action }) => !!project && !!action),
				untilDestroyed(this)
			)
			.subscribe(({ action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
					case CrudActionEnum.UPDATED:
					case CrudActionEnum.DELETED:
						this.checkProjectSelectorVisibility();
						break;
				}
			});
		this.employeeStore.employeeAction$
			.pipe(
				filter(({ employee }) => !!employee),
				untilDestroyed(this)
			)
			.subscribe(({ action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
					case CrudActionEnum.UPDATED:
					case CrudActionEnum.DELETED:
						this.checkEmployeeSelectorVisibility();
						break;
				}
			});
	}

	toggleTimerWindow() {
		this.timeTrackerService.showTimerWindow = !this.timeTrackerService
			.showTimerWindow;
	}

	toggleSidebarActions(item: ISidebarActionConfig) {
		const sidebar = this.navigationBuilderService.getSidebarById(item.id);
		if (this.showExtraActions) {
			this.toggleExtraActions(false);
			this.sidebarService.expand(sidebar.id);
		} else {
			this.sidebarService.toggle(false, sidebar.id);
		}
	}

	toggleSidebar(): boolean {
		if (this.showExtraActions) {
			this.toggleExtraActions(false);
			this.sidebarService.expand('menu-sidebar');
		} else {
			this.sidebarService.toggle(true, 'menu-sidebar');
			this.layoutService.changeLayoutSize();
		}
		return false;
	}

	navigateHome() {
		//this.menuService.navigateHome();
		return false;
	}

	closeExtraActionsIfLarge(event?: any) {
		let width;

		if (event !== undefined) {
			width = event.target.innerWidth;
		} else {
			width = document.body.clientWidth;
		}

		if (width >= 1200) {
			this.showExtraActions = false;
		}
	}

	toggleExtraActions(bool?: boolean) {
		this.showExtraActions =
			bool !== undefined ? bool : !this.showExtraActions;
	}

	loadItems() {
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasPermissionE = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_VIEW
				);
				this.hasPermissionI = this.store.hasPermission(
					PermissionsEnum.ORG_INCOMES_VIEW
				);
				this.hasPermissionP = this.store.hasPermission(
					PermissionsEnum.ORG_PROPOSALS_VIEW
				);
				this.hasPermissionIn = this.store.hasPermission(
					PermissionsEnum.INVOICES_VIEW
				);
				this.hasPermissionTask = this.store.hasPermission(
					PermissionsEnum.ORG_CANDIDATES_TASK_EDIT
				);

				this.hasPermissionEEdit = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
				this.hasPermissionIEdit = this.store.hasPermission(
					PermissionsEnum.ORG_INCOMES_EDIT
				);
				this.hasPermissionPEdit = this.store.hasPermission(
					PermissionsEnum.ORG_PROPOSALS_EDIT
				);
				this.hasPermissionInEdit = this.store.hasPermission(
					PermissionsEnum.INVOICES_EDIT
				);
				this.hasPermissionEmpEdit = this.store.hasPermission(
					PermissionsEnum.ORG_EMPLOYEES_EDIT
				);
				this.hasPermissionProjEdit = this.store.hasPermission(
					PermissionsEnum.ORG_PROJECT_EDIT
				);
				this.hasPermissionContactEdit = this.store.hasPermission(
					PermissionsEnum.ORG_CONTACT_EDIT
				);
				this.hasPermissionTeamEdit = this.store.hasPermission(
					PermissionsEnum.ORG_TEAM_EDIT
				);
				this.hasPermissionContractEdit = this.store.hasPermission(
					PermissionsEnum.ORG_CONTRACT_EDIT
				);
				this.hasPermissionPaymentAddEdit = this.store.hasPermission(
					PermissionsEnum.ORG_PAYMENT_ADD_EDIT
				);
				this.hasPermissionTimesheetEdit = this.store.hasPermission(
					PermissionsEnum.TIMESHEET_EDIT_TIME
				);
				this.hasPermissionCandidateEdit = this.store.hasPermission(
					PermissionsEnum.ORG_CANDIDATES_EDIT
				);
			});

		this.createContextMenu = [
			{
				title: this.getTranslation('CONTEXT_MENU.TIMER'),
				icon: 'clock-outline',
				hidden: !this.isEmployee || this.isElectron,
				data: {
					action: this.actions.START_TIMER //This opens the timer popup in the header, managed by menu.itemClick TOO: Start the timer also
				}
			},
			// TODO: divider
			{
				title: this.getTranslation('CONTEXT_MENU.ADD_INCOME'),
				icon: 'plus-circle-outline',
				link: 'pages/accounting/income',
				hidden: !this.hasPermissionI || !this.hasPermissionIEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.ADD_EXPENSE'),
				icon: 'minus-circle-outline',
				link: 'pages/accounting/expenses',
				hidden: !this.hasPermissionE || !this.hasPermissionEEdit
			},
			// TODO: divider
			{
				title: this.getTranslation('CONTEXT_MENU.INVOICE'),
				icon: 'archive-outline',
				link: 'pages/accounting/invoices/add',
				hidden: !this.hasPermissionI || !this.hasPermissionIEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.ESTIMATE'),
				icon: 'file-outline',
				link: 'pages/accounting/invoices/estimates/add',
				hidden: !this.hasPermissionInEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.PAYMENT'),
				icon: 'clipboard-outline',
				link: 'pages/accounting/payments',
				hidden: !this.hasPermissionPaymentAddEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.TIME_LOG'),
				icon: 'clock-outline',
				link: 'pages/employees/timesheets/daily',
				hidden: !this.hasPermissionTimesheetEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.CANDIDATE'),
				icon: 'person-done-outline',
				link: 'pages/employees/candidates',
				hidden: !this.hasPermissionCandidateEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.PROPOSAL'),
				icon: 'paper-plane-outline',
				link: 'pages/sales/proposals/register',
				hidden: !this.hasPermissionP || !this.hasPermissionPEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.CONTRACT'),
				icon: 'file-text-outline',
				link: 'pages/integrations/upwork',
				hidden: !this.hasPermissionContractEdit
			},
			// TODO: divider
			{
				title: this.getTranslation('CONTEXT_MENU.TEAM'),
				icon: 'people-outline',
				link: `pages/organization/teams`,
				hidden: !this.hasPermissionTeamEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.TASK'),
				icon: 'calendar-outline',
				link: 'pages/tasks/dashboard',
				hidden: !this.hasPermissionTask
			},
			{
				title: this.getTranslation('CONTEXT_MENU.CONTACT'),
				icon: 'person-done-outline',
				link: `pages/contacts`,
				hidden: !this.hasPermissionContactEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.PROJECT'),
				icon: 'color-palette-outline',
				link: `pages/organization/projects`,
				hidden: !this.hasPermissionProjEdit
			},
			// TODO: divider
			{
				title: this.getTranslation('CONTEXT_MENU.ADD_EMPLOYEE'),
				icon: 'people-outline',
				link: 'pages/employees',
				hidden: !this.hasPermissionEmpEdit
			}
		];

		this.supportContextMenu = [
			{
				title: this.getTranslation('CONTEXT_MENU.CHAT'),
				icon: 'message-square-outline'
			},
			{
				title: this.getTranslation('CONTEXT_MENU.FAQ'),
				icon: 'clipboard-outline'
			},
			{
				title: this.getTranslation('CONTEXT_MENU.HELP'),
				icon: 'question-mark-circle-outline',
				link: 'pages/help'
			},
			{
				title: this.getTranslation('MENU.ABOUT'),
				icon: 'droplet-outline',
				link: 'pages/about'
			}
		];
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.createContextMenu = [];
			this.supportContextMenu = [];
			this.loadItems();
		});
	}

	private _checkTimerStatus() {
		const { employee, tenantId } = this.user;
		if (employee && employee.id) {
			this.timeTrackerService.checkTimerStatus(tenantId);
		}
	}

	ngOnDestroy() {}
}
