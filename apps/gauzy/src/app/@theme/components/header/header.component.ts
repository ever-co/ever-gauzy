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
import { filter, first, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services/store.service';
import { PermissionsEnum, TimeLogType } from '@gauzy/contracts';
import { IUser } from '@gauzy/contracts';
import { TimeTrackerService } from '../../../@shared/time-tracker/time-tracker.service';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '../../../../environments/environment';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { NO_EMPLOYEE_SELECTED } from './selectors/employee/employee.component';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-header',
	styleUrls: ['./header.component.scss'],
	templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit, OnDestroy, AfterViewInit {
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
	organizationSelected = false;
	theme: string;
	createContextMenu: NbMenuItem[];
	supportContextMenu: NbMenuItem[];
	showExtraActions = false;
	actions = {
		START_TIMER: 'START_TIMER'
	};
	timerDuration: string;

	constructor(
		private sidebarService: NbSidebarService,
		private menuService: NbMenuService,
		private layoutService: LayoutService,
		private themeService: NbThemeService,
		private router: Router,
		private translate: TranslateService,
		private store: Store,
		private timeTrackerService: TimeTrackerService,
		private usersOrganizationsService: UsersOrganizationsService,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private organizationProjectsService: OrganizationProjectsService
	) {}

	ngOnInit() {
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
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this),
				tap(() => this.loadItems())
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user) => !!user),
				untilDestroyed(this)
			)
			.subscribe((user) => {
				this.user = user;
				this.isEmployee = !!user && !!user.employeeId;
				//check header selectors dropdown permissions
				this.checkSelectorsPermission();
				//check timer status for employee
				if (this.isEmployee) {
					this._checkTimerStatus();
				}
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

	async checkSelectorsPermission() {
		const { userId } = this.store;
		const { tenantId } = this.store.user;

		const { items: userOrg } = await this.usersOrganizationsService.getAll(
			[],
			{
				userId,
				tenantId
			}
		);

		if (userOrg.length > 1) {
			const count = await this.organizationProjectsService.getCount([], {
				organizationId: userOrg[0].organizationId,
				tenantId: this.user.tenantId
			});
			if (count > 1) {
				this.showProjectsSelector = true;
			}
		}

		if (
			this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_ORGANIZATION
			) &&
			userOrg.length > 1
		) {
			this.showOrganizationsSelector = true;
		} else {
			if (userOrg.length > 0) {
				const org = await this.organizationsService
					.getById(userOrg[0].organizationId)
					.pipe(first())
					.toPromise();
				this.store.selectedOrganization = org;
			}
		}
		if (
			this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
		) {
			this.showEmployeesSelector = true;
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
	}

	ngAfterViewInit(): void {}

	toggleTimerWindow() {
		this.timeTrackerService.showTimerWindow = !this.timeTrackerService
			.showTimerWindow;
	}

	toggleChangelogMenu(): boolean {
		if (this.showExtraActions) {
			this.toggleExtraActions(false);
			this.sidebarService.expand('changelog-sidebar');
		} else {
			this.sidebarService.toggle(false, 'changelog-sidebar');
		}
		return false;
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

	toggleSettings(): boolean {
		if (this.showExtraActions) {
			this.toggleExtraActions(false);
			this.sidebarService.expand('settings-sidebar');
		} else {
			this.sidebarService.toggle(false, 'settings-sidebar');
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

	getTranslation(prefix: string) {
		let result = '';
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
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
