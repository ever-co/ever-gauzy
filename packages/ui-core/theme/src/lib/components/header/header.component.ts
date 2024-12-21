import { Component, Input, OnDestroy, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { NbSidebarService, NbThemeService, NbMenuItem, NbDialogService, NbDialogRef } from '@nebular/theme';
import { combineLatest, firstValueFrom, Observable, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import hotkeys, { HotkeysEvent } from 'hotkeys-js';
import {
	CrudActionEnum,
	IDateRangePicker,
	IEmployee,
	IOrganization,
	IOrganizationProject,
	ISelectedEmployee,
	IUser,
	PermissionsEnum,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import {
	DEFAULT_SELECTOR_VISIBILITY,
	DateRangePickerBuilderService,
	EmployeeStore,
	EmployeesService,
	ISelectorVisibility,
	ISidebarActionConfig,
	LayoutService,
	NavigationBuilderService,
	OrganizationEditStore,
	OrganizationProjectStore,
	OrganizationProjectsService,
	OrganizationTeamStore,
	OrganizationTeamsService,
	OrganizationsService,
	SelectorBuilderService,
	Store,
	TimeTrackerService,
	UsersOrganizationsService
} from '@gauzy/ui-core/core';
import { ALL_EMPLOYEES_SELECTED, NO_EMPLOYEE_SELECTED, QuickActionsComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-header',
    styleUrls: ['./header.component.scss'],
    templateUrl: './header.component.html',
    standalone: false
})
export class HeaderComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	isEmployee = false;
	isElectron: boolean = environment.IS_ELECTRON;
	isDemo: boolean = environment.DEMO;

	@Input() position = 'normal';
	user: IUser;
	employee: IEmployee;
	employee$: Observable<ISelectedEmployee> = this.store.selectedEmployee$;
	project$: Observable<IOrganizationProject> = this.store.selectedProject$;

	showEmployeesSelector: boolean;
	showOrganizationsSelector: boolean;
	showProjectsSelector: boolean;
	showTeamsSelector: boolean;
	showDateSelector: boolean = true;
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

	private shortcutsMap = new Map<string, () => void>();

	quickActionsRef: NbDialogRef<QuickActionsComponent> | null;

	defaultShortcuts = {
		quickActions: 'ctrl+Q',
		createInvoice: 'I',
		receivedInvoices: 'shift+I',
		createEstimate: 'E',
		receivedEstimates: 'shift+E',
		createPayment: 'P',
		createIncome: 'C',
		createExpense: 'X',
		createTeam: 'G',
		createTask: 'T',
		createProject: 'J',
		viewTasks: 'shift+T',
		viewTeamTasks: 'shift+G',
		addEmployee: 'A+E',
		addInventory: 'A+I',
		addEquipment: 'A+Q',
		addVendor: 'A+V',
		addDepartment: 'A+D',
		timeLog: 'shift+L',
		viewAppointments: 'shift+A',
		viewTimeActivity: 'shift+S',
		startTimer: 'S',
		stopTimer: 'O',
		createCandidate: 'U',
		createProposal: 'R',
		createContract: 'K',
		createLead: 'D',
		createCustomer: 'M',
		createClient: 'N',
		viewClients: 'shift+N'
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
				tap((user: IUser) => (this.employee = user?.employee)),
				tap((user: IUser) => (this.isEmployee = !!user && !!user.employee?.id)),
				untilDestroyed(this)
			)
			.subscribe(async () => {
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

		this._applyTranslationOnContextMenu();
		this._loadContextMenus();
		// -- setup shortcuts keyboards
		this.setupShortcuts();
	}

	ngAfterViewInit(): void {
		this.themeService
			.onThemeChange()
			.pipe(
				tap((theme) => {
					this.theme = theme.name;
					this.cd.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
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

	/**
	 * Setup shortcuts
	 */
	private setupShortcuts() {
		// -- register the default shortcuts
		this.registerDefaultShortcuts();

		hotkeys(
			'*',
			{
				scope: 'defaultShortcuts'
			},
			(event: KeyboardEvent, handler: HotkeysEvent) => {
				const pressedKeys: string = this.pressedKeysToString(handler);
				// -- prevent triggering shortcuts when typing in NbOptions (searchable inputs)
				if ((event.target as Element).localName === 'nb-option') return;
				if (this.shortcutsMap.has(pressedKeys)) {
					// -- close dialog if open when using shortcuts and prevent closing dialog by pressing unregistered keys
					this.quickActionsRef &&
					pressedKeys !== this.defaultShortcuts.quickActions.toLowerCase() &&
					this.shortcutsMap.has(pressedKeys)
						? this.quickActionsRef.close()
						: null;
					if (handler.scope === 'defaultShortcuts' && this.shortcutsMap.has(pressedKeys)) {
						this.shortcutsMap.get(pressedKeys)();
					}
				}
			}
		);
	}

	/**
	 * Pressed keys to string
	 *
	 * @param handler
	 * @returns
	 */
	private pressedKeysToString(handler: HotkeysEvent): string {
		return handler.keys
			.map((keyNum) => {
				return hotkeys.modifierMap[keyNum]
					? hotkeys.modifierMap[keyNum].toString().replace('Key', '')
					: String.fromCharCode(keyNum).toLowerCase();
			})
			.join('+');
	}

	/**
	 * Register shortcut
	 * @param keys
	 * @param action
	 */
	private registerShortcut(keys: string, action: () => void) {
		this.shortcutsMap.set(keys.toLowerCase(), action);
		hotkeys(keys, 'defaultShortcuts', () => {});
		hotkeys.setScope('defaultShortcuts');
	}

	/**
	 * Register default shortcuts
	 */
	private registerDefaultShortcuts() {
		// -- Toggle QuickActions Dialog
		this.registerShortcut(this.defaultShortcuts.quickActions, () => this.toggleQuickActionsDialog());
		// -- Accounting
		this.registerShortcut(this.defaultShortcuts.createInvoice, () => this.navigateTo('createInvoice'));
		this.registerShortcut(this.defaultShortcuts.receivedInvoices, () => this.navigateTo('receivedInvoices'));
		this.registerShortcut(this.defaultShortcuts.createIncome, () => this.navigateTo('createIncome'));
		this.registerShortcut(this.defaultShortcuts.receivedEstimates, () => this.navigateTo('receivedEstimates'));
		this.registerShortcut(this.defaultShortcuts.createExpense, () => this.navigateTo('createExpense'));
		this.registerShortcut(this.defaultShortcuts.createEstimate, () => this.navigateTo('createEstimate'));
		this.registerShortcut(this.defaultShortcuts.createPayment, () => this.navigateTo('createPayment'));
		// -- project management
		this.registerShortcut(this.defaultShortcuts.createTeam, () => this.navigateTo('createTeam'));
		this.registerShortcut(this.defaultShortcuts.createTask, () => this.navigateTo('createTask'));
		this.registerShortcut(this.defaultShortcuts.createProject, () => this.navigateTo('createProject'));
		this.registerShortcut(this.defaultShortcuts.viewTasks, () => this.navigateTo('viewTasks'));
		this.registerShortcut(this.defaultShortcuts.viewTeamTasks, () => this.navigateTo('viewTeamTasks'));
		// -- Organization
		this.registerShortcut(this.defaultShortcuts.addEmployee, () => this.navigateTo('addEmployee'));
		this.registerShortcut(this.defaultShortcuts.addInventory, () => this.navigateTo('addInventory'));
		this.registerShortcut(this.defaultShortcuts.addEquipment, () => this.navigateTo('addEquipment'));
		this.registerShortcut(this.defaultShortcuts.addVendor, () => this.navigateTo('addVendor'));
		this.registerShortcut(this.defaultShortcuts.addDepartment, () => this.navigateTo('addDepartment'));
		// -- Jobs
		this.registerShortcut(this.defaultShortcuts.createCandidate, () => this.navigateTo('createCandidate'));
		this.registerShortcut(this.defaultShortcuts.createProposal, () => this.navigateTo('createProposal'));
		this.registerShortcut(this.defaultShortcuts.createContract, () => this.navigateTo('createContract'));
		// -- contact
		this.registerShortcut(this.defaultShortcuts.createLead, () => this.navigateTo('createLead'));
		this.registerShortcut(this.defaultShortcuts.createCustomer, () => this.navigateTo('createCustomer'));
		this.registerShortcut(this.defaultShortcuts.createClient, () => this.navigateTo('createClient'));
		this.registerShortcut(this.defaultShortcuts.viewClients, () => this.navigateTo('viewClients'));
		// -- Time Tracking
		this.registerShortcut(this.defaultShortcuts.timeLog, () => this.navigateTo('timeLog'));
		this.registerShortcut(this.defaultShortcuts.viewAppointments, () => this.navigateTo('viewAppointments'));
		this.registerShortcut(this.defaultShortcuts.viewTimeActivity, () => this.navigateTo('viewTimeActivity'));
		// -- Start timer
		this.registerShortcut(this.defaultShortcuts.startTimer, () => {
			if (this.timeTrackerService.running) return;
			this.timeTrackerService.setTimeLogType(TimeLogType.TRACKED);
			this.timeTrackerService.openAndStartTimer();
		});
		// -- Stop timer
		this.registerShortcut(this.defaultShortcuts.stopTimer, async () => {
			if (this.timeTrackerService.running) await this.timeTrackerService.toggle();
		});
	}

	/**
	 * Toggles the quick actions dialog, opening it if it's not open, and closing it if it's already open.
	 */
	private toggleQuickActionsDialog(): void {
		if (!this.quickActionsRef) {
			this.openQuickActions();
		} else {
			this.quickActionsRef.close();
		}
	}

	/**
	 *
	 * @param value
	 * @returns
	 */
	private formatShortcut(value: string): string {
		return value
			.split('+')
			.map((key) => key.toUpperCase())
			.join(' + ');
	}

	/**
	 * Navigate to
	 *
	 * @param action
	 */
	private navigateTo(action: string) {
		const itemMenu = this.createQuickActionsMenu.find((item: NbMenuItem) => item?.data?.action === action);
		itemMenu ? this.router.navigate([itemMenu.link], { queryParams: { ...itemMenu.queryParams } }) : null;
	}

	/**
	 * Open quick actions
	 */
	openQuickActions() {
		this.quickActionsRef = this.dialogService.open(QuickActionsComponent, {
			context: {
				items: this.createQuickActionsMenu,
				shortcutDialog: this.defaultShortcuts.quickActions
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
	async checkProjectSelectorVisibility() {
		// Hidden project selector if not activate for current page
		if (
			!this.organization ||
			!this.selectorsVisibility.project ||
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		) {
			return;
		}

		// Extract organization and tenant IDs
		const { id: organizationId, tenantId } = this.organization;

		// Include member if employeeId or store user's employeeId is provided
		const employeeId = this.store.user.employee?.id || this.store.selectedEmployee?.id;

		// Get project count
		const count = await this.organizationProjectsService.getCount({
			organizationId,
			tenantId,
			...(employeeId && { members: { employeeId } })
		});

		//	Show project selector if count > 0
		this.showProjectsSelector = count > 0;
	}

	/**
	 * Check Team selector visibility
	 *
	 * @returns
	 */
	async checkTeamSelectorVisibility() {
		// hidden team selector if not activate for current page
		if (
			!this.organization ||
			!this.selectorsVisibility.team ||
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
		) {
			return;
		}

		// Extract organization and tenant IDs
		const { id: organizationId, tenantId } = this.organization;

		// Include member if employeeId or store user's employeeId is provided
		const employeeId = this.store.user.employee?.id || this.store.selectedEmployee?.id;

		// Get team count
		const count = await this.organizationTeamsService.getCount({
			organizationId,
			tenantId,
			...(employeeId && { members: { employeeId } })
		});

		// Show team selector if count > 0
		this.showTeamsSelector = count > 0;
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
			const { id: organizationId, tenantId } = this.organization;

			// Get employee count
			const { total: employeeCount } = await this.employeesService.getWorkingCount(
				organizationId,
				tenantId,
				this.selectedDateRange
			);

			// If employee count > 0, show employees selector
			this.showEmployeesSelector = employeeCount > 0;

			// If no employee selected and employee count > 0, set selected employee to ALL_EMPLOYEES_SELECTED
			if (this.showEmployeesSelector && !this.store.selectedEmployee) {
				this.store.selectedEmployee = ALL_EMPLOYEES_SELECTED;
			}
		} else {
			// If employee is not selected, get the first employee
			if (this.isEmployee) {
				const { id: employeeId } = this.user.employee;

				if (employeeId) {
					// Get employee by ID
					const employee: IEmployee = await firstValueFrom(this.employeesService.getEmployeeById(employeeId));

					// If employee found, set selected employee
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
				} else {
					this.store.selectedEmployee = NO_EMPLOYEE_SELECTED;
				}
			}
		}
	}

	/**
	 * Check organization selector visibility
	 */
	async checkOrganizationSelectorVisibility() {
		const { id: userId, tenantId } = this.store.user;

		// Count user organizations based on the provided userId and tenantId
		const orgCount = await this.usersOrganizationsService.getCount({ userId, tenantId });

		// Check if the current user has the permission to change the selected organization
		const hasChangeSelectedOrganizationPermission: boolean = this.store.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_ORGANIZATION
		);

		// Show organization selector only if user has permission and more than 1 organization exists
		this.showOrganizationsSelector = hasChangeSelectedOrganizationPermission && orgCount > 1;

		// If organization selector is not shown and the user has at least one organization
		if (!this.showOrganizationsSelector && orgCount > 0) {
			try {
				// Retrieve user organizations
				const { items: userOrg } = await this.usersOrganizationsService.getAll([], {
					userId,
					tenantId
				});

				// If organizations exist, set the first one into local storage
				if (userOrg.length > 0) {
					const [firstUserOrg] = userOrg;

					// Retrieve organization details for the employee
					const organization = await firstValueFrom(
						this.organizationsService.getById(firstUserOrg.organizationId, ['contact'])
					);

					// Set the selected organization in local storage
					this.store.selectedOrganization = organization;
				}
			} catch (error) {
				console.error('Error retrieving user organizations or organization details:', error);
			}
		}
	}

	/**
	 * Toggle timer window
	 */
	toggleTimerWindow() {
		this.timeTrackerService.showTimerWindow = !this.timeTrackerService.showTimerWindow;
	}

	/**
	 * Toggle sidebar actions
	 * @param item
	 */
	toggleSidebarActions(item: ISidebarActionConfig) {
		const sidebar = this.navigationBuilderService.getSidebarById(item.id);
		if (this.showExtraActions) {
			this.toggleExtraActions(false);
			this.sidebarService.expand(sidebar.id);
		} else {
			this.sidebarService.toggle(false, sidebar.id);
		}
	}

	/**
	 * Toggle sidebar
	 * @returns
	 */
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

	/**
	 * Navigate home
	 * @returns
	 */
	navigateHome() {
		//this.menuService.navigateHome();
		return false;
	}

	/**
	 *
	 * @param event
	 */
	closeExtraActionsIfLarge(event?: any) {
		let width: number;

		if (event !== undefined) {
			width = event.target.innerWidth;
		} else {
			width = document.body.clientWidth;
		}

		if (width >= 1200) {
			this.showExtraActions = false;
		}
	}

	/**
	 * Toggle extra actions
	 * @param bool
	 */
	toggleExtraActions(bool?: boolean) {
		this.showExtraActions = bool !== undefined ? bool : !this.showExtraActions;
	}

	/**
	 * Load context menus
	 */
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
								text: this.formatShortcut(this.defaultShortcuts.createInvoice),
								status: 'control'
							}
						}
				  ]
				: []),
			...(!!this.user.employee
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.RECEIVED_INVOICES'),
							icon: {
								icon: 'file-invoice-dollar',
								pack: 'font-awesome'
							},
							link: 'pages/accounting/invoices/received-invoices',
							data: {
								action: 'receivedInvoices'
							},
							badge: {
								text: this.formatShortcut(this.defaultShortcuts.receivedInvoices),
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
								text: this.formatShortcut(this.defaultShortcuts.createIncome),
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
								text: this.formatShortcut(this.defaultShortcuts.createExpense),
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
								text: this.formatShortcut(this.defaultShortcuts.createEstimate),
								status: 'control'
							}
						}
				  ]
				: []),
			...(!!this.user.employee
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.RECEIVED_ESTIMATES'),
							icon: {
								icon: 'file-invoice',
								pack: 'font-awesome'
							},
							link: 'pages/accounting/invoices/received-estimates',
							data: {
								action: 'receivedEstimates'
							},
							badge: {
								text: this.formatShortcut(this.defaultShortcuts.receivedEstimates),
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
								text: this.formatShortcut(this.defaultShortcuts.createPayment),
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
								text: this.formatShortcut(this.defaultShortcuts.addEmployee),
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
								text: this.formatShortcut(this.defaultShortcuts.addInventory),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_EQUIPMENT_EDIT, PermissionsEnum.ALL_ORG_EDIT) ||
			!!this.user.employee
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
								text: this.formatShortcut(this.defaultShortcuts.addEquipment),
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
								text: this.formatShortcut(this.defaultShortcuts.addVendor),
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
								text: this.formatShortcut(this.defaultShortcuts.addDepartment),
								status: 'control'
							}
						}
				  ]
				: []),

			// Divider (Project Management)
			...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
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
								text: this.formatShortcut(this.defaultShortcuts.createTeam),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasPermission(PermissionsEnum.ORG_TASK_ADD)
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
								text: this.formatShortcut(this.defaultShortcuts.createTask),
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
								text: this.formatShortcut(this.defaultShortcuts.createProject),
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
								text: this.formatShortcut(this.defaultShortcuts.viewTasks),
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
								text: this.formatShortcut(this.defaultShortcuts.viewTeamTasks),
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
								text: this.formatShortcut(this.defaultShortcuts.createCandidate),
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
								text: this.formatShortcut(this.defaultShortcuts.createProposal),
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
								text: this.formatShortcut(this.defaultShortcuts.createContract),
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
								text: this.formatShortcut(this.defaultShortcuts.createLead),
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
								text: this.formatShortcut(this.defaultShortcuts.createCustomer),
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
								text: this.formatShortcut(this.defaultShortcuts.createClient),
								status: 'control'
							}
						}
				  ]
				: []),
			...(!!this.user.employee
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.VIEW_CLIENTS'),
							icon: 'person-outline',
							link: 'pages/contacts/clients',
							data: {
								action: 'viewClients'
							},
							badge: {
								text: this.formatShortcut(this.defaultShortcuts.viewClients),
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
								text: this.formatShortcut(this.defaultShortcuts.timeLog),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.TIME_TRACKER)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.VIEW_APPOINTMENTS'),
							icon: 'calendar-outline',
							link: 'pages/employees/appointments',
							data: {
								action: 'viewAppointments'
							},
							badge: {
								text: this.formatShortcut(this.defaultShortcuts.viewAppointments),
								status: 'control'
							}
						}
				  ]
				: []),
			...(this.store.hasAnyPermission(PermissionsEnum.TIME_TRACKER)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.VIEW_TIME_ACTIVITY'),
							icon: 'activity-outline',
							link: 'pages/employees/activity/time-activities',
							data: {
								action: 'viewTimeActivity'
							},
							badge: {
								text: this.formatShortcut(this.defaultShortcuts.viewTimeActivity),
								status: 'control'
							}
						}
				  ]
				: []),
			...(!!this.user.employee
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.START_TIMER'),
							icon: 'play-circle-outline',
							hidden: !this.isEmployee || this.isElectron,
							data: {
								action: this.actions.START_TIMER // -- Start the timer
							},
							badge: {
								text: this.formatShortcut(this.defaultShortcuts.startTimer),
								status: 'control'
							}
						}
				  ]
				: []),
			...(!this.store.hasAnyPermission(PermissionsEnum.TIMESHEET_EDIT_TIME)
				? [
						{
							title: this.getTranslation('QUICK_ACTIONS_MENU.STOP_TIMER'),
							icon: 'pause-circle-outline',
							hidden: !this.isEmployee || this.isElectron,
							data: {
								action: this.actions.STOP_TIMER // -- Stop the timer
							},
							badge: {
								text: this.formatShortcut(this.defaultShortcuts.stopTimer),
								status: 'control'
							}
						}
				  ]
				: [])
		];
	}

	/**
	 * Apply translation on context menu
	 */
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

	/**
	 * Checks the timer status if time tracking is enabled.
	 */
	private async _checkTimerStatus() {
		if (!this.organization || !this.isEnabledTimeTracking()) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const { id: employeeId } = this.employee;

		// Check timer status using the TimeTrackerService
		await this.timeTrackerService.checkTimerStatus({
			organizationId,
			tenantId,
			employeeId,
			source: TimeLogSourceEnum.WEB_TIMER
		});
	}

	/**
	 * Checks if web timer is enabled.
	 * @returns {boolean} - True if web timer is enabled, false otherwise.
	 */
	isEnabledTimeTracking(): boolean {
		const { employee, store, isElectron } = this;
		const isTrackingEnabled = employee?.id && employee?.isTrackingEnabled;
		const hasPermission = store.hasPermission(PermissionsEnum.TIME_TRACKER);

		return isTrackingEnabled && hasPermission && !isElectron;
	}

	/**
	 * On collapse
	 * @param event
	 */
	onCollapse(event: boolean) {
		this.isCollapse = event;
	}

	ngOnDestroy() {}
}
