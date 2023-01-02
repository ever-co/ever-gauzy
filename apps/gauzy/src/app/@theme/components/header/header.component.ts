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
import {
	ALL_EMPLOYEES_SELECTED,
	NO_EMPLOYEE_SELECTED
} from './selectors/employee';
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
		private readonly dateRangeService: DateRangePickerBuilderService,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly organizationProjectStore: OrganizationProjectStore,
		private readonly employeeStore: EmployeeStore,
		private readonly selectorBuilderService: SelectorBuilderService,
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
				tap(() => this._loadContextMenus()),
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
				filter((user: IUser) => !!user),
				tap((user: IUser) => this.user = user),
				tap((user: IUser) => this.isEmployee = !!user && !!user.employeeId),
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
	}

	/**
	 * Check project selector visibility
	 *
	 * @returns
	 */
	checkProjectSelectorVisibility() {
		// hidden project selector if not activate for current page
		if (!this.organization || !this.selectorsVisibility.project || !this.store.hasAnyPermission(
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_PROJECT_VIEW
		)) {
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
		if (
			this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
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
				const employee = await firstValueFrom(
					this.employeesService.getEmployeeById(employeeId)
				);
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
					['contact'],
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

	private _loadContextMenus() {
		this.createContextMenu = [
			...(this.store.hasAnyPermission(PermissionsEnum.TIME_TRACKER) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.TIMER'),
					icon: 'clock-outline',
					hidden: !this.isEmployee || this.isElectron,
					data: {
						action: this.actions.START_TIMER //This opens the timer popup in the header, managed by menu.itemClick TOO: Start the timer also
					}
				}
			] : []),
			// TODO: divider
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_INCOMES_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.ADD_INCOME'),
					icon: 'plus-circle-outline',
					link: 'pages/accounting/income'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_EXPENSES_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.ADD_EXPENSE'),
					icon: 'minus-circle-outline',
					link: 'pages/accounting/expenses'
				}
			] : []),
			// TODO: divider
			...(this.store.hasAnyPermission(PermissionsEnum.INVOICES_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.INVOICE'),
					icon: 'archive-outline',
					link: 'pages/accounting/invoices/add'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ESTIMATES_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.ESTIMATE'),
					icon: 'file-outline',
					link: 'pages/accounting/invoices/estimates/add'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_PAYMENT_ADD_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.PAYMENT'),
					icon: 'clipboard-outline',
					link: 'pages/accounting/payments'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.TIMESHEET_EDIT_TIME, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.TIME_LOG'),
					icon: 'clock-outline',
					link: 'pages/employees/timesheets/daily'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CANDIDATES_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.CANDIDATE'),
					icon: 'person-done-outline',
					link: 'pages/employees/candidates'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_PROPOSALS_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.PROPOSAL'),
					icon: 'paper-plane-outline',
					link: 'pages/sales/proposals/register'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CONTRACT_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.CONTRACT'),
					icon: 'file-text-outline',
					link: 'pages/integrations/upwork'
				}
			] : []),
			// TODO: divider
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_TEAM_ADD, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.TEAM'),
					icon: 'people-outline',
					link: `pages/organization/teams`
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_TASK_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.TASK'),
					icon: 'calendar-outline',
					link: 'pages/tasks/dashboard'
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_CONTACT_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.CONTACT'),
					icon: 'person-done-outline',
					link: `pages/contacts`
				}
			] : []),
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_PROJECT_ADD, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.PROJECT'),
					icon: 'color-palette-outline',
					link: `pages/organization/projects`
				}
			] : []),
			// TODO: divider
			...(this.store.hasAnyPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.ALL_ORG_EDIT) ? [
				{
					title: this.getTranslation('CONTEXT_MENU.ADD_EMPLOYEE'),
					icon: 'people-outline',
					link: 'pages/employees'
				}
			] : [])
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

	private _applyTranslationOnContextMenu() {
		this.translate.onLangChange
			.pipe(
				tap(() => {
					this.createContextMenu = [];
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
			const { tenantId } = this.user;

			await this.timeTrackerService.checkTimerStatus({
				organizationId,
				tenantId,
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
