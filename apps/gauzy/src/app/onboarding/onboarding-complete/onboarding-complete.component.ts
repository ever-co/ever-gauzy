import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IUser } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { UsersService } from '../../@core/services';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
@Component({
	selector: 'ga-onboarding-complete',
	templateUrl: './onboarding-complete.component.html',
	styleUrls: ['./onboarding-complete.component.scss']
})
export class OnboardingCompleteComponent
	extends TranslationBaseComponent
	implements OnInit {
	constructor(
		private router: Router,
		public readonly translationService: TranslateService,
		private readonly store: Store,
		private usersService: UsersService,
		private ngxPermissionsService: NgxPermissionsService
	) {
		super(translationService);
	}

	blocks = [];

	ngOnInit() {
		const id = this.store.userId;
		if (!id) return;

		this.usersService
			.getMe(['role', 'role.rolePermissions'])
			.then((user: IUser) => {
				//only enabled permissions assign to logged in user
				const permissions = user.role.rolePermissions
					.filter(({ enabled }) => enabled)
					.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
			})
			.catch()
			.finally(() => this.getBlocks());
	}

	getBlocks() {
		this.blocks = [
			{
				rows: [
					{
						title: this.getTranslation('MENU.DASHBOARD'),
						description: 'Go to dashboard',
						status: 'info',
						icon: 'home-outline',
						navigateTo: '/'
					},
					{
						title: this.getTranslation('MENU.EMPLOYEES'),
						description: 'Add or Invite Employees',
						status: 'primary',
						icon: 'people-outline',
						navigateTo: '/pages/employees'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.INVOICES'),
						description: 'Create Invoices',
						status: 'success',
						icon: 'file-text-outline',
						navigateTo: '/pages/accounting/invoices'
					},
					{
						title: this.getTranslation('MENU.ESTIMATES'),
						description: 'Create Estimates',
						status: 'warning',
						icon: 'file-text-outline',
						navigateTo: '/pages/accounting/invoices/estimates'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.PAYMENTS'),
						description: 'Create Payments',
						status: 'info',
						icon: 'file-text-outline',
						navigateTo: '/pages/accounting/payments'
					},
					{
						title: this.getTranslation('MENU.PIPELINES'),
						description: 'Create Pipeline, View Deals',
						status: 'primary',
						icon: 'home-outline',
						navigateTo: '/pages/sales/pipelines'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('TIMESHEET.TIME_TRACKING'),
						description:
							'Download Desktop App, Create First Timesheet',
						status: 'primary',
						icon: 'file-text-outline',
						navigateTo: '/pages/employees/timesheets'
					},
					{
						title: this.getTranslation('MENU.TIME_ACTIVITY'),
						description:
							'Screenshots, App, Visited Sites, Activities',
						status: 'info',
						icon: 'file-text-outline',
						navigateTo: '/pages/employees/activity'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.JOBS'),
						description: 'Job Search & Jobs Matching',
						status: 'warning',
						icon: 'file-text-outline',
						navigateTo: '/pages/jobs/search'
					},
					{
						title: this.getTranslation(
							'CANDIDATES_PAGE.JOBS_CANDIDATES'
						),
						description: 'Manage Candidates, Interviews & Invites',
						status: 'success',
						icon: 'home-outline',
						navigateTo: '/pages/employees/candidates'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation(
							'DASHBOARD_PAGE.PROJECT_MANAGEMENT'
						),
						description: 'New Project, Manage Tasks',
						status: 'primary',
						icon: 'home-outline',
						navigateTo: '/pages/dashboard/project-management'
					},
					{
						title: this.getTranslation('ORGANIZATIONS_PAGE.TEAMS'),
						description: 'Team Manage',
						status: 'primary',
						icon: 'home-outline',
						navigateTo: '/pages/organization/teams'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.INCOME'),
						description: 'Create Incomes',
						status: 'success',
						icon: 'file-text-outline',
						navigateTo: '/pages/accounting/income'
					},
					{
						title: this.getTranslation('MENU.EXPENSES'),
						description: 'Create Expenses',
						status: 'warning',
						icon: 'home-outline',
						navigateTo: '/pages/accounting/expenses'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.PROPOSALS'),
						description: 'Proposals & Proposal Template Manage',
						status: 'primary',
						icon: 'file-text-outline',
						navigateTo: '/pages/sales/proposals'
					},
					{
						title: this.getTranslation('MENU.TASKS'),
						description: "Task Dashboard & Team's Tasks",
						status: 'info',
						icon: 'home-outline',
						navigateTo: '/pages/tasks/dashboard'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.APPOINTMENTS'),
						description:
							'Appointments, Schedules & Book Public Appointment',
						status: 'warning',
						icon: 'file-text-outline',
						navigateTo: '/pages/employees/appointments'
					},
					{
						title: this.getTranslation('MENU.APPROVALS'),
						description: 'Approval Request & Approval Policy',
						status: 'success',
						icon: 'home-outline',
						navigateTo: '/pages/employees/approvals'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.TIME_OFF'),
						description: 'Time Off & Time Off Policy',
						status: 'info',
						icon: 'file-text-outline',
						navigateTo: '/pages/employees/time-off'
					},
					{
						title: this.getTranslation('MENU.POSITIONS'),
						description: 'Positions Manage',
						status: 'primary',
						icon: 'home-outline',
						navigateTo: '/pages/employees/positions'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.CONTACTS'),
						description: 'Create Leads, Customers & Clients',
						status: 'success',
						icon: 'file-text-outline',
						navigateTo: '/pages/contacts/leads'
					},
					{
						title: this.getTranslation('MENU.GOALS'),
						description: 'Manage Company / Employees Goals',
						status: 'warning',
						icon: 'file-text-outline',
						navigateTo: '/pages/goals'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.USERS'),
						description: 'Add or Invite Users',
						status: 'info',
						icon: 'file-text-outline',
						navigateTo: '/pages/users'
					},
					{
						title: this.getTranslation('MENU.ORGANIZATIONS'),
						description:
							'Create Organization, Manage info, location & settings',
						status: 'primary',
						icon: 'file-text-outline',
						navigateTo: '/pages/organizations'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.INTEGRATIONS'),
						description: 'Available Apps & Integrations',
						status: 'warning',
						icon: 'file-text-outline',
						navigateTo: '/pages/integrations/list'
					},
					{
						title: this.getTranslation('MENU.HELP'),
						description: 'Find out more about how to use Gauzy',
						status: 'success',
						icon: 'home-outline',
						navigateTo: '/pages/help'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation('MENU.EMAIL_HISTORY'),
						description: 'Manage Email History',
						status: 'primary',
						icon: 'file-text-outline',
						navigateTo: '/pages/settings/email-history'
					},
					{
						title: this.getTranslation('MENU.EMAIL_TEMPLATES'),
						description: 'Customize Email Templates',
						status: 'info',
						icon: 'file-text-outline',
						navigateTo: '/pages/settings/email-templates'
					}
				]
			},
			{
				rows: [
					{
						title: this.getTranslation(
							'MENU.IMPORT_EXPORT.IMPORT_EXPORT'
						),
						description: 'Import/Export Database Backup',
						status: 'success',
						icon: 'file-text-outline',
						navigateTo: '/pages/settings/import-export/export'
					},
					{
						title: this.getTranslation('MENU.ROLES'),
						description: 'Manage Roles & Permissions',
						status: 'info',
						icon: 'file-text-outline',
						navigateTo: '/pages/settings/roles'
					}
				]
			}
		];
	}

	navigateTo(url: string) {
		this.router.navigate([url]);
	}
}
