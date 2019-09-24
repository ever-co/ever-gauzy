import { Component, Input, OnDestroy, OnInit, OnChanges } from '@angular/core';
import {
	NbMenuService,
	NbSidebarService,
	NbThemeService
} from '@nebular/theme';
import { LayoutService } from '../../../@core/utils';
import { Subject } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ngx-header',
	styleUrls: ['./header.component.scss'],
	templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit, OnDestroy {
	@Input() position = 'normal';

	showEmployeesSelector = true;
	showDateSelector = true;
	showOrganizationsSelector = true;
	theme: string;

	createContextMenu = [
		{
			title: 'Start Timer',
			icon: 'clock-outline',
			link: '#'
		},
		// TODO: divider
		{
			title: 'Income',
			icon: 'plus-circle-outline',
			link: 'pages/income'
		},
		{
			title: 'Expense',
			icon: 'minus-circle-outline',
			link: 'pages/expenses'
		},
		// TODO: divider
		{
			title: 'Invoice',
			icon: 'archive-outline',
			link: '#'
		},
		{
			title: 'Proposal',
			icon: 'paper-plane-outline',
			link: '#'
		},
		{
			title: 'Contract',
			icon: 'file-text-outline',
			link: '#'
		},
		// TODO: divider
		{
			title: 'Task',
			icon: 'calendar-outline',
			link: '#'
		},
		{
			title: 'Client',
			icon: 'person-done-outline',
			link: '#'
		},
		{
			title: 'Project',
			icon: 'color-palette-outline',
			link: '#'
		},
		// TODO: divider
		{
			title: 'Employee',
			icon: 'people-outline',
			link: 'pages/employees'
		}
	];

	supportContextMenu = [
		{
			title: 'Support Chat'
		},
		{
			title: 'FAQ'
		},
		{
			title: 'Help'
		}
	];

	private _ngDestroy$ = new Subject<void>();

	constructor(
		private sidebarService: NbSidebarService,
		private menuService: NbMenuService,
		private layoutService: LayoutService,
		private themeService: NbThemeService,
		private router: Router
	) {}

	ngOnInit() {
		this.showSelectors(this.router.url);

		this.router.events
			.pipe(filter((event) => event instanceof NavigationEnd))
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((e) => {
				this.showSelectors(e['url']);
			});

		this.menuService
			.onItemClick()
			.pipe(filter(({ tag }) => tag === 'create-context-menu'))
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((e) => {
				this.router.navigate([e.item.link], {
					queryParams: {
						openAddDialog: true
					}
				});
			});

		this.themeService
			.onThemeChange()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((t) => {
				this.theme = t.name;
			});
	}

	toggleSidebar(): boolean {
		this.sidebarService.toggle(true, 'menu-sidebar');
		this.layoutService.changeLayoutSize();

		return false;
	}

	toggleSettings(): boolean {
		this.sidebarService.toggle(false, 'settings-sidebar');
		return false;
	}

	navigateHome() {
		this.menuService.navigateHome();
		return false;
	}

	private showSelectors(url: string) {
		this.showEmployeesSelector = true;
		this.showDateSelector = true;
		this.showOrganizationsSelector = true;

		if (url.endsWith('/employees')) {
			this.showEmployeesSelector = false;
			this.showDateSelector = false;
		}

		const profileRegex = RegExp('/pages/employees/edit/.*/profile', 'i');
		const organizationRegex = RegExp(
			'/pages/organizations/edit/.*/settings',
			'i'
		);

		if (profileRegex.test(url) || organizationRegex.test(url)) {
			this.showEmployeesSelector = false;
			this.showDateSelector = false;
			this.showOrganizationsSelector = false;
		}

		if (url.endsWith('/pages/auth/profile')) {
			this.showEmployeesSelector = false;
			this.showDateSelector = false;
			this.showOrganizationsSelector = false;
		}

		if (url.endsWith('/organizations')) {
			this.showEmployeesSelector = false;
			this.showDateSelector = false;
			this.showOrganizationsSelector = false;
		}

		const organizationEditRegex = RegExp(
			'/pages/organizations/edit/[A-Za-z0-9-]+$',
			'i'
		);

		if (organizationEditRegex.test(url)) {
			this.showEmployeesSelector = false;
			this.showDateSelector = true;
			this.showOrganizationsSelector = true;
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
