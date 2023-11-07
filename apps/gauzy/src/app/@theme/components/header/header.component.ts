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
	NbMenuItem,
	NbDialogService,
	NbDialogRef
} from '@nebular/theme';
import { combineLatest, firstValueFrom, lastValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import {
	CrudActionEnum,
	IDateRangePicker,
	IOrganization,
	IUser,
	PermissionsEnum,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { environment } from '../../../../environments/environment';
import { ALL_EMPLOYEES_SELECTED, NO_EMPLOYEE_SELECTED } from './selectors/employee';
import { TimeTrackerService } from '../../../@shared/time-tracker/time-tracker.service';
import {
	DateRangePickerBuilderService,
	EmployeesService,
	EmployeeStore,
	ISidebarActionConfig,
	NavigationBuilderService,
	OrganizationEditStore,
	OrganizationProjectsService,
	OrganizationProjectStore,
	OrganizationsService,
	OrganizationTeamsService,
	Store,
	UsersOrganizationsService
} from '../../../@core/services';
import { DEFAULT_SELECTOR_VISIBILITY, ISelectorVisibility, SelectorBuilderService } from '../../../@core/services';
import { LayoutService } from '../../../@core/utils';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { ChangeDetectorRef } from '@angular/core';
import { OrganizationTeamStore } from '../../../@core/services/organization-team-store.service';
import { QuickActionsComponent } from '../../../@shared/dialogs/quick-actions/quick-actions.component';
import hotkeys from 'hotkeys-js';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-header',
	styleUrls: ['./header.component.scss'],
	templateUrl: './header.component.html'
})
export class HeaderComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	isEmployee = false;
	isElectron: boolean = environment.IS_ELECTRON;
	isDemo: boolean = environment.DEMO;

	@Input() position = 'normal';
	user: IUser;

	showEmployeesSelector: boolean;
	showOrganizationsSelector: boolean;
	showProjectsSelector: boolean;
	showTeamsSelector: boolean;

	showDateSelector = true;
	theme: string;
	createQuickActionsMenu: NbMenuItem[];
	supportContextMenu: NbMenuItem[];
	showExtraActions = false;
	actions = {
		START_TIMER: 'START_TIMER',
		STOP_TIMER: 'STOP_TIMER'
	};
	timerDuration: string;
	organization: IOrganization;
	selectedDateRange: IDateRangePicker;

	subject$: Subject<any> = new Subject();
	selectorsVisibility: ISelectorVisibility;

	isCollapse: boolean = true;
	@Input() expanded: boolean = true;
	quickActionsRef: NbDialogRef<QuickActionsComponent> | null;

	shortcuts = {
		quickActions: 'ctrl+Q',
		createInvoice: 'shift+I',
		createEstimate: 'shift+E',
		createPayment: 'shift+P',
		createIncome: 'shift+C',
		createExpense: 'shift+X',
		createTeam: 'shift+T',
		createTask: 'shift+K',
		createProject: 'shift+J',
		viewTasks: 'shift+V+K',
		viewTeamTasks: 'shift+V+S',
		addEmployee: 'shift+A+E',
		addInventory: 'shift+A+I',
		addEquipment: 'shift+A+Q',
		addVendor: 'shift+A+V',
		addDepartment: 'shift+A+D',
		timeLog: 'shift+L',
		startTimer: 'shift+S',
		stopTimer: 'shift+O',
		createCandidate: 'shift+U',
		createProposal: 'shift+R',
		createContract: 'shift+G',
		createLead: 'shift+D',
		createCustomer: 'shift+M',
		createClient: 'shift+N'
	};

	constructor(
		private readonly sidebarService: NbSidebarService,
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
		private readonly organizationTeamsService: OrganizationTeamsService,
		public readonly navigationBuilderService: NavigationBuilderService,
		private readonly dateRangeService: DateRangePickerBuilderService,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly organizationProjectStore: OrganizationProjectStore,
		private readonly organizationTeamStore: OrganizationTeamStore,
		private readonly employeeStore: EmployeeStore,
		private readonly selectorBuilderService: SelectorBuilderService,
		private readonly cd: ChangeDetectorRef,
		private readonly dialogService: NbDialogService
	) {
		super(translate);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(1300),
				tap(() => this.checkEmployeeSelectorVisibility()),
				tap(() => this.checkProjectSelectorVisibility()),
				tap(() => this.checkTeamSelectorVisibility()),
				tap(() => this._loadContextMenus()),
				untilDestroyed(this)
			)
			.subscribe();
		this.selectorBuilderService.selectors$
			.pipe(
				distinctUntilChange(),
				debounceTime(200),
				tap((selectors) => {
					this.selectorsVisibility = Object.assign({}, DEFAULT_SELECTOR_VISIBILITY, selectors);
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
		this.timeTrackerService.duration$.pipe(untilDestroyed(this)).subscribe((time) => {
			if (!isNaN(time)) {
				this.timerDuration = moment.utc(time * 1000).format('HH:mm:ss');
			}
		});
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap((user: IUser) => (this.isEmployee = !!user && !!user.employeeId)),
				untilDestroyed(this)
			)
			.subscribe(async (user) => {
				//check header selectors dropdown permissions
				await this.checkOrganizationSelectorVisibility();
				//check timer status for employee
				if (this.isEmployee) {
					this._checkTimerStatus();
				}
			});
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.dateRangeService.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				filter(([organization]) => !!organization),
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
		this._applyTranslationOnContextMenu();
		this._loadContextMenus();
		// -- enable shorcuts keyboards
		this.enableShortcuts();
	}

	private enableShortcuts() {
		const shortcutsKeysString = Object.values(this.shortcuts).join(', ');
		hotkeys(shortcutsKeysString, (event, handler) => {
			// -- Close Dialog (QuickActions) in case it is open and shortcut used
			this.quickActionsRef && handler.key !== this.shortcuts.quickActions ? this.quickActionsRef.close() : null;
			switch (handler.key) {
				// -- Toggle QuickActions
				case this.shortcuts.quickActions:
					if (!this.quickActionsRef) {
						this.openQuickActions();
						return;
					}
					if (this.quickActionsRef) {
						this.quickActionsRef.close();
						return;
					}
					break;
				// -- Acounting
				case this.shortcuts.createInvoice:
					this.navigateTo('createInvoice');
					break;
				case this.shortcuts.createIncome:
					this.navigateTo('createIncome');
					break;
				case this.shortcuts.createExpense:
					this.navigateTo('createExpense');
					break;
				case this.shortcuts.createEstimate:
					this.navigateTo('createEstimate');
					break;
				case this.shortcuts.createPayment:
					this.navigateTo('createPayment');
					break;
				// -- project management
				case this.shortcuts.createTeam:
					this.navigateTo('createTeam');
					break;
				case this.shortcuts.createTask:
					this.navigateTo('createTask');
					break;
				case this.shortcuts.createProject:
					this.navigateTo('createProject');
					break;
				case this.shortcuts.viewTasks:
					this.navigateTo('viewTasks');
					break;
				case this.shortcuts.viewTeamTasks:
					this.navigateTo('viewTeamTasks');
					break;
				// Organization
				case this.shortcuts.addEmployee:
					this.navigateTo('addEmployee');
					break;
				case this.shortcuts.addInventory:
					this.navigateTo('addInventory');
					break;
				case this.shortcuts.addEquipment:
					this.navigateTo('addEquipment');
					break;
				case this.shortcuts.addVendor:
					this.navigateTo('addVendor');
					break;
				case this.shortcuts.addDepartment:
					this.navigateTo('addDepartment');
					break;
				// Time Tracking
				case this.shortcuts.timeLog:
					this.navigateTo('timeLog');
					break;
				case this.shortcuts.startTimer:
					if (this.timeTrackerService.running) return;
					this.timeTrackerService.setTimeLogType(TimeLogType.TRACKED);
					this.timeTrackerService.openAndStartTimer();
					break;
				case this.shortcuts.stopTimer:
					if (this.timeTrackerService.running) this.timeTrackerService.toggle();
					break;
				// Jobs
				case this.shortcuts.createCandidate:
					this.navigateTo('createCandidate');
					break;
				case this.shortcuts.createProposal:
					this.navigateTo('createProposal');
					break;
				case this.shortcuts.createContract:
					this.navigateTo('createContract');
					break;
				// Contacts
				case this.shortcuts.createLead:
					this.navigateTo('createLead');
					break;
				case this.shortcuts.createCustomer:
					this.navigateTo('createCustomer');
					break;
				case this.shortcuts.createClient:
					this.navigateTo('createClient');
					break;
				default:
					return;
			}
		});
	}

	private formatShortcut(value: string): string {
		return value
			.split('+')
			.map((key) => key.toUpperCase())
			.join(' + ');
	}

	private navigateTo(action: string) {
		const itemMenu = this.createQuickActionsMenu.find((item: NbMenuItem) => item.data?.action === action);
		this.router.navigate([itemMenu.link], { queryParams: { ...itemMenu.queryParams } });
	}

	openQuickActions() {
		this.quickActionsRef = this.dialogService.open(QuickActionsComponent, {
			context: {
				items: this.createQuickActionsMenu,
				shortcutDialog: this.shortcuts.quickActions
			}
		});
		// -- subscribe to reset (quickActionsRef) to null onDialogClose
		this.quickActionsRef?.onClose.subscribe(() => {
			this.quickActionsRef = null;
		});
	}

	/**
	 * Check project selector visibility
	 *
	 * @returns
	 */
	checkProjectSelectorVisibility() {
		// hidden project selector if not activate for current page
		if (
			!this.organization ||
			!this.selectorsVisibility.project ||
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.organizationProjectsService
			.getCount({
				organizationId,
				tenantId
			})
			.then((count) => {
				this.showProjectsSelector = count > 0;
			});
	}

	/**
	 * Check Team selector visibility
	 *
	 * @returns
	 */
	checkTeamSelectorVisibility() {
		// hidden team selector if not activate for current page
		if (
			!this.organization ||
			!this.selectorsVisibility.team ||
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
		) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.organizationTeamsService
			.getCount({
				organizationId,
				tenantId
			})
			.then((count) => {
				this.showTeamsSelector = count > 0;
			});
	}

	/**
	 * Check employee selector visibility
	 *
	 * @returns
	 */
	async checkEmployeeSelectorVisibility() {
		// hidden employee selector if not activate for current page
		if (!this.organization || !this.selectorsVisibility.employee) {
			return;
		}
		if (this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;
			const { total: employeeCount } = await this.employeesService.getWorkingCount(
				organizationId,
				tenantId,
				this.selectedDateRange,
				true
			);
			this.showEmployeesSelector = employeeCount > 0;
			if (this.showEmployeesSelector && !this.store.selectedEmployee) {
				this.store.selectedEmployee = ALL_EMPLOYEES_SELECTED;
			}
		} else {
			if (this.isEmployee) {
				const { employeeId } = this.user;
				const employee = await firstValueFrom(this.employeesService.getEmployeeById(employeeId));
				if (isNotEmpty(employee)) {
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
		}
	}

	async checkOrganizationSelectorVisibility() {
		// hidden organization selector if not activate for current page

		const { userId } = this.store;
		const { tenantId } = this.store.user;
		const { items: userOrg } = await this.usersOrganizationsService.getAll([], {
			userId,
			tenantId
		});
		if (this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_ORGANIZATION) && userOrg.length > 1) {
			this.showOrganizationsSelector = true;
		} else {
			if (userOrg.length > 0) {
				const [firstUserOrg] = userOrg;
				/**
				 * GET organization for employee
				 */
				const organization$ = this.organizationsService.getById(firstUserOrg.organizationId, ['contact']);
				const organization = await lastValueFrom(organization$);

				this.store.selectedOrganization = organization;
				this.showOrganizationsSelector = false;
			}
		}
	}

	ngAfterViewInit(): void {
		this.organizationEditStore.organizationAction$
			.pipe(
				filter(({ action, organization }) => !!action && !!organization),
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

		this.organizationTeamStore.organizationTeamAction$
			.pipe(
				filter(({ action, team }) => !!action && !!team),
				tap(() => this.organizationTeamStore.destroy()),
				untilDestroyed(this)
			)
			.subscribe(({ action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
					case CrudActionEnum.UPDATED:
					case CrudActionEnum.DELETED:
						this.checkTeamSelectorVisibility();
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
		this.timeTrackerService.showTimerWindow = !this.timeTrackerService.showTimerWindow;
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
		this.showExtraActions = bool !== undefined ? bool : !this.showExtraActions;
	}

	private _loadContextMenus() {
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
		this.createQuickActionsMenu = [
			// Divider (Accounting)
			...(this.store.hasAnyPermission(PermissionsEnum.INVOICES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_INVOICE'),
							icon: 'file-text-outline',
							link: 'pages/accounting/invoices/add',
							data: {
								action: 'createInvoice'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createInvoice),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_INCOMES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_INCOME'),
							icon: 'plus-circle-outline',
							link: 'pages/accounting/income',
							data: {
								action: 'createIncome'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createIncome),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_EXPENSES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_EXPENSE'),
							icon: 'minus-circle-outline',
							link: 'pages/accounting/expenses',
							data: {
								action: 'createExpense'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createExpense),
								status: 'control'
							}
						}
				  ]
				: []),

			...(this.store.hasAnyPermission(PermissionsEnum.ESTIMATES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_ESTIMATE'),
							icon: 'file-outline',
							link: 'pages/accounting/invoices/estimates/add',
							data: {
								action: 'createEstimate'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createEstimate),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_PAYMENT_ADD_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_PAYMENT'),
							icon: 'credit-card-outline',
							link: 'pages/accounting/payments',
							data: {
								action: 'createPayment'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createPayment),
								status: 'control'
							}
						}
				  ]
				: []),
			// Divider (Organization)
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.ADD_EMPLOYEE'),
							icon: 'people-outline',
							link: 'pages/employees',
							data: {
								action: 'addEmployee'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.addEmployee),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.ADD_INVENTORY'),
							icon: 'inbox-outline',
							link: 'pages/organization/inventory/create',
							data: {
								action: 'addInventory'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.addInventory),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_EQUIPMENT_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.ADD_EQUIPMENT'),
							icon: 'pantone-outline',
							link: 'pages/organization/equipment',
							data: {
								action: 'addEquipment'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.addEquipment),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.ADD_VENDOR'),
							icon: 'car-outline',
							link: 'pages/organization/vendors',
							data: {
								action: 'addVendor'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.addVendor),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.ADD_DEPARTMENT'),
							icon: 'briefcase-outline',
							link: 'pages/organization/departments',
							data: {
								action: 'addDepartment'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.addDepartment),
								status: 'control'
							}
						}
				  ]
				: []),

			// Divider (Project Management)
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_TEAM_ADD, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_TEAM'),
							icon: 'people-outline',
							link: 'pages/organization/teams',
							data: {
								action: 'createTeam'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createTeam),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_TASK_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_TASK'),
							icon: 'archive-outline',
							link: 'pages/tasks/dashboard',
							data: {
								action: 'createTask'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createTask),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_PROJECT_ADD, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_PROJECT'),
							icon: 'color-palette-outline',
							link: 'pages/organization/projects/create',
							data: {
								action: 'createProject'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createProject),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_TASK_VIEW, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.VIEW_TASKS'),
							icon: 'calendar-outline',
							link: 'pages/tasks/dashboard',
							data: {
								action: 'viewTasks'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.viewTasks),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_TASK_VIEW, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.VIEW_TEAM_TASKS'),
							icon: 'layers-outline',
							link: 'pages/tasks/team',
							data: {
								action: 'viewTeamTasks'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.viewTeamTasks),
								status: 'control'
							}
						}
				  ]
				: []),

			// Divider (Jobs)
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CANDIDATES_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_CANDIDATE'),
							icon: 'person-add-outline',
							link: 'pages/employees/candidates',
							data: {
								action: 'createCandidate'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createCandidate),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_PROPOSALS_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_PROPOSAL'),
							icon: 'paper-plane-outline',
							link: 'pages/sales/proposals/register',
							data: {
								action: 'createProposal'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createProposal),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CONTRACT_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_CONTRACT'),
							icon: 'file-text-outline',
							link: 'pages/integrations/upwork',
							data: {
								action: 'createContract'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createContract),
								status: 'control'
							}
						}
				  ]
				: []),
			// Divider (Contacts)
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CONTACT_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_LEAD'),
							icon: 'shield-outline',
							link: 'pages/contacts/leads',
							data: {
								action: 'createLead'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createLead),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CONTACT_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_CUSTOMER'),
							icon: 'person-done-outline',
							link: 'pages/contacts/customers',
							data: {
								action: 'createCustomer'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createCustomer),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CONTACT_EDIT, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.CREATE_CLIENT'),
							icon: 'person-outline',
							link: 'pages/contacts/clients',
							data: {
								action: 'createClient'
							},
							queryParams: {
								openAddDialog: true
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.createClient),
								status: 'control'
							}
						}
				  ]
				: []),
			// Divider (Time Tracking)
			...(this.store.hasAnyPermission(PermissionsEnum.TIMESHEET_EDIT_TIME, PermissionsEnum.ALL_ORG_EDIT)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.TIME_LOG'),
							icon: 'clock-outline',
							link: 'pages/employees/timesheets/daily',
							data: {
								action: 'timeLog'
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.timeLog),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.TIME_TRACKER)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.START_TIMER'),
							icon: 'play-circle-outline',
							hidden: !this.isEmployee || this.isElectron,
							data: {
								action: this.actions.START_TIMER // -- Start the timer
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.startTimer),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.TIME_TRACKER)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.STOP_TIMER'),
							icon: 'pause-circle-outline',
							hidden: !this.isEmployee || this.isElectron,
							data: {
								action: this.actions.STOP_TIMER // -- Stop the timer
							},
							badge: {
								text: this.formatShortcut(this.shortcuts.stopTimer),
								status: 'control'
							}
						}
				  ]
				: [])
		];
	}

	private _applyTranslationOnContextMenu() {
		this.translate.onLangChange
			.pipe(
				tap(() => {
					// this.createContextMenu = [];
					this.createQuickActionsMenu = [];
					this.supportContextMenu = [];
					this._loadContextMenus();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private async _checkTimerStatus() {
		if (!this.organization) {
			return;
		}
		if (this.isEnabledTimeTracking()) {
			const { id: organizationId } = this.organization;
			const { tenantId, employeeId } = this.user;

			await this.timeTrackerService.checkTimerStatus({
				organizationId,
				tenantId,
				employeeId,
				source: TimeLogSourceEnum.WEB_TIMER
			});
		}
	}

	/**
	 * Enabled/Disabled Web Timer
	 */
	isEnabledTimeTracking() {
		const { employee } = this.user;
		const isTrackingEnabled = employee?.id && employee?.isTrackingEnabled;
		const hasPermission = this.store.hasPermission(PermissionsEnum.TIME_TRACKER);
		return isTrackingEnabled && hasPermission && !this.isElectron;
	}

	onCollapse(event: boolean) {
		this.isCollapse = event;
	}

	ngOnDestroy() {}
}
