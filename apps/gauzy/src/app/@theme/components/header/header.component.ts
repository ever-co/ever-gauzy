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
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services/store.service';
import { PermissionsEnum } from '@gauzy/models';
import { User } from '@gauzy/models';
import { TimeTrackerService } from '../../../@shared/time-tracker/time-tracker.service';
import * as moment from 'moment';
import { untilDestroyed } from 'ngx-take-until-destroy';

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
	isEmployee = false;

	@Input() position = 'normal';
	user: User;
	@Input() showEmployeesSelector;
	@Input() showOrganizationsSelector;

	showDateSelector = true;
	organizationSelected = false;
	theme: string;
	createContextMenu: NbMenuItem[];
	supportContextMenu: NbMenuItem[];
	showExtraActions = false;

	actions = {
		START_TIMER: 'START_TIMER'
	};

	private _selectedOrganizationId: string;
	timerDuration: string;

	constructor(
		private sidebarService: NbSidebarService,
		private menuService: NbMenuService,
		private layoutService: LayoutService,
		private themeService: NbThemeService,
		private router: Router,
		private translate: TranslateService,
		private store: Store,
		private timeTrackerService: TimeTrackerService
	) {}

	ngOnInit() {
		this.router.events
			.pipe(filter((event) => event instanceof NavigationEnd))
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.timeTrackerService.showTimerWindow = false;
			});

		this.timeTrackerService.duration$
			.pipe(untilDestroyed(this))
			.subscribe((time) => {
				this.timerDuration = moment.utc(time * 1000).format('HH:mm:ss');
			});

		this.menuService
			.onItemClick()
			.pipe(filter(({ tag }) => tag === 'create-context-menu'))
			.pipe(untilDestroyed(this))
			.subscribe((e) => {
				if (e.item.data && e.item.data.action) {
					switch (e.item.data.action) {
						case this.actions.START_TIMER:
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
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					this.loadItems();
				}
			});

		this.store.user$.pipe(untilDestroyed(this)).subscribe((user) => {
			this.user = user;
			this.isEmployee = !!user.employeeId;
		});

		this.themeService
			.onThemeChange()
			.pipe(untilDestroyed(this))
			.subscribe((t) => {
				this.theme = t.name;
			});

		this.loadItems();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit(): void {}

	toggleTimerWindow() {
		this.timeTrackerService.showTimerWindow = !this.timeTrackerService
			.showTimerWindow;
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
			});

		this.createContextMenu = [
			{
				title: this.getTranslation('CONTEXT_MENU.TIMER'),
				icon: 'clock-outline',
				hidden: !this.isEmployee,
				data: {
					action: this.actions.START_TIMER //This opens the timer poup in the header, managed by menu.itemClick TOO: Start the timer also
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
				title: this.getTranslation('CONTEXT_MENU.PROPOSAL'),
				icon: 'paper-plane-outline',
				link: 'pages/sales/proposals/register',
				hidden: !this.hasPermissionP || !this.hasPermissionPEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.CONTRACT'),
				icon: 'file-text-outline',
				link: 'pages/integrations/upwork/contracts',
				hidden: !this.hasPermissionContractEdit
			},
			// TODO: divider
			{
				title: this.getTranslation('CONTEXT_MENU.TEAM'),
				icon: 'people-outline',
				link: `pages/organizations/edit/${this._selectedOrganizationId}/settings/teams`,
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
				link: `pages/organizations/edit/${this._selectedOrganizationId}/settings/contacts`,
				hidden: !this.hasPermissionContactEdit
			},
			{
				title: this.getTranslation('CONTEXT_MENU.PROJECT'),
				icon: 'color-palette-outline',
				link: `pages/organizations/edit/${this._selectedOrganizationId}/settings/projects`,
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

	ngOnDestroy() {}
}
