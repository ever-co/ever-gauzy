import {
	Component,
	Input,
	OnDestroy,
	OnInit,
	AfterViewInit
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import {
	NbMenuService,
	NbSidebarService,
	NbThemeService,
	NbMenuItem
} from '@nebular/theme';
import { combineLatest, firstValueFrom, lastValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	CrudActionEnum,
	IDateRangePicker,
	IOrganization,
	IUser,
	PermissionsEnum,
	TimeLogType
} from '@gauzy/contracts';
import { environment } from '../../../../environments/environment';
import {
	ALL_EMPLOYEES_SELECTED,
	NO_EMPLOYEE_SELECTED
} from './selectors/employee';
import { TimeTrackerService } from '../../../@shared/time-tracker/time-tracker.service';
import {
	EmployeesService,
	EmployeeStore,
	ISidebarActionConfig,
	NavigationBuilderService,
	OrganizationEditStore,
	OrganizationProjectsService,
	OrganizationProjectStore,
	OrganizationsService,
	Store,
	UsersOrganizationsService
} from '../../../@core/services';
import {
	DEFAULT_SELECTOR_VISIBILITY,
	ISelectorVisibility,
	SelectorBuilderService
} from '../../../@core/services';
import { LayoutService } from '../../../@core/utils';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { ChangeDetectorRef } from '@angular/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-header',
	styleUrls: ['./header.component.scss'],
	templateUrl: './header.component.html'
})
export class HeaderComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {

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
	hasPermissionTimeTracker = false;
	isEmployee = false;
	isElectron: boolean = environment.IS_ELECTRON;
	isDemo: boolean = environment.DEMO;

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
	selectedDateRange: IDateRangePicker;

	subject$: Subject<any> = new Subject();
	selectorsVisibility: ISelectorVisibility;

	isCollapse: boolean = true;
	@Input() expanded: boolean = true;

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
		public readonly selectorBuilderService: SelectorBuilderService,
		private readonly cd: ChangeDetectorRef
	) {
		super(translate);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(1300),
				tap(() => this.checkEmployeeSelectorVisibility()),
				tap(() => this.checkProjectSelectorVisibility()),
				tap(() => this._loadRolePermissions()),
				untilDestroyed(this)
			)
			.subscribe();
		this.selectorBuilderService.selectors$
			.pipe(
				distinctUntilChange(),
				debounceTime(200),
				tap((selectors) => {
					this.selectorsVisibility = Object.assign(
						{},
						DEFAULT_SELECTOR_VISIBILITY,
						selectors
					);
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				tap(() => (this.timeTrackerService.showTimerWindow = false)),
				untilDestroyed(this)
			)
			.subscribe();
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
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				untilDestroyed(this)
			)
			.subscribe(([organization, dateRange]) => {
				this.organization = organization;
				this.selectedDateRange = dateRange;
				this.subject$.next(true);
			});
		this.themeService
			.onThemeChange()
			.pipe(
				tap((theme) => theme),
				untilDestroyed(this)
			)
			.subscribe((theme) => {
				this.theme = theme.name;
				this.cd.detectChanges();
			});
		this._applyTranslationOnSmartTable();
		this._loadRolePermissions();
	}

	checkProjectSelectorVisibility() {
		// hidden project selector if not activate for current page
		if (!this.organization || !this.selectorsVisibility.project) {
			return;
		}

		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		this.organizationProjectsService.getCount({
			organizationId,
			tenantId
		}).then((count) => {
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
			.getWorkingCount(organizationId, tenantId, this.selectedDateRange, true)
			.then(async ({ total: employeeCount }) => {
				if (
					this.store.hasPermission(
						PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
					)
				) {
					this.showEmployeesSelector = employeeCount > 0;
					if (this.showEmployeesSelector && !this.store.selectedEmployee) {
						this.store.selectedEmployee = ALL_EMPLOYEES_SELECTED;
					}
				} else {
					const employee = await firstValueFrom(this.employeesService.getEmployeeById(
						this.user.employeeId,
						[]
					));
					if (employee) {
						this.store.selectedEmployee = {
							id: employee.id,
							firstName: this.user.firstName,
							lastName: this.user.lastName,
							fullName: this.user.name,
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
				/**
				 * GET organization for employee
				 */
				const organization$ = this.organizationsService.getById(
					firstUserOrg.organizationId,
					null,
					['contact']
				);
				const organization = await lastValueFrom(organization$);

				this.store.selectedOrganization = organization;
				this.showOrganizationsSelector = false;
			}
		}
	}

	ngAfterViewInit(): void {
		this.organizationEditStore.organizationAction$
			.pipe(
				filter(
					({ action, organization }) => !!action && !!organization
				),
				tap(() => this.organizationEditStore.destroy()),
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
				filter(({ action, project }) => !!action && !!project),
				tap(() => this.organizationProjectStore.destroy()),
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
				filter(({ action, employees }) => !!action && !!employees),
				tap(() => this.employeeStore.destroy()),
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
		this.cd.detectChanges();
	}

	toggleTimerWindow() {
		this.timeTrackerService.showTimerWindow =
			!this.timeTrackerService.showTimerWindow;
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

	_loadRolePermissions() {
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
			this._loadRolePermissions();
		});
	}

	private async _checkTimerStatus() {
		if (this.isEnabledTimeTracking()) {
			const { tenantId } = this.user;
			await this.timeTrackerService.checkTimerStatus(tenantId);
		}
	}

	/**
	 * Enabled/Disabled Web Timer
	 */
	isEnabledTimeTracking() {
		const { employee } = this.user;
		const isTrackingEnabled = employee?.id && employee?.isTrackingEnabled;
		const hasPermission = this.store.hasPermission(
			PermissionsEnum.TIME_TRACKER
		);
		return isTrackingEnabled && hasPermission && !this.isElectron;
	}

  onCollapse(event: boolean){
    this.isCollapse = event;
  }

	ngOnDestroy() {}
}
