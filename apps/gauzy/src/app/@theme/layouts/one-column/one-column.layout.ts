import {
	AfterViewInit,
	Component,
	Inject,
	PLATFORM_ID,
	ViewChild,
	OnInit
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
	NbLayoutComponent,
	NbLayoutDirectionService,
	NbLayoutDirection
} from '@nebular/theme';
import { UsersService } from '../../../@core/services/users.service';

import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { Store } from '../../../@core/services/store.service';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { first } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services';
import { PermissionsEnum } from '@gauzy/models';
import { NO_EMPLOYEE_SELECTED } from '../../components/header/selectors/employee/employee.component';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-one-column-layout',
	styleUrls: ['./one-column.layout.scss'],
	templateUrl: './one-column.layout.html'
})
export class OneColumnLayoutComponent implements OnInit, AfterViewInit {
	constructor(
		@Inject(PLATFORM_ID) private platformId,
		private windowModeBlockScrollService: WindowModeBlockScrollService,
		private usersService: UsersService,
		private usersOrganizationsService: UsersOrganizationsService,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private store: Store,
		private directionService: NbLayoutDirectionService,
		private router: Router
	) {}
	@ViewChild(NbLayoutComponent) layout: NbLayoutComponent;

	user: any;
	showOrganizationsSelector = false;
	showEmployeesSelector = false;

	userMenu = [
		{ title: 'Profile', link: '/pages/auth/profile' },
		{ title: 'Log out', link: '/auth/logout' }
	];

	layout_direction: NbLayoutDirection = this.directionService.getDirection();
	sidebar_class = 'menu-sidebar';

	ngOnInit() {
		this.loadUserData();

		if (this.layout_direction === NbLayoutDirection.RTL) {
			this.sidebar_class = 'menu-sidebar-rtl';
		}
	}

	ngAfterViewInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.windowModeBlockScrollService.register(this.layout);
		}
	}

	private async loadUserData() {
		const id = this.store.userId;
		if (!id) return;
		this.user = await this.usersService.getMe([
			'employee',
			'role',
			'role.rolePermissions',
			'tenant'
		]);

		//When a new user registers & logs in for the first time, he/she does not have tenantId.
		//In this case, we redirect the user to the onboarding page to create their first organization, tenant, role.
		if (!this.user.tenantId) {
			this.router.navigate(['/onboarding/tenant']);
			return;
		}

		this.store.userRolePermissions = this.user.role.rolePermissions;
		this.store.user = this.user;

		if (
			this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_ORGANIZATION
			)
		) {
			this.showOrganizationsSelector = true;
		} else {
			const {
				items: userOrg
			} = await this.usersOrganizationsService.getAll([], { userId: id });
			const org = await this.organizationsService
				.getById(userOrg[0].organizationId)
				.pipe(first())
				.toPromise();
			this.store.selectedOrganization = org;
		}

		if (
			this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
		) {
			this.showEmployeesSelector = true;
			this.store.selectedEmployee = null;
		} else {
			const { items: emp } = await this.employeesService
				.getAll([], { user: this.user })
				.pipe(first())
				.toPromise();
			if (emp && emp.length > 0) {
				this.store.selectedEmployee = {
					id: emp[0].id,
					firstName: this.user.firstName,
					lastName: this.user.lastName,
					imageUrl: this.user.imageUrl
				};
			} else {
				this.store.selectedEmployee = NO_EMPLOYEE_SELECTED;
			}
		}
	}
}
