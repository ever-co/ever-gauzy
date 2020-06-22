import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { ActivatedRoute, Router } from '@angular/router';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { EmployeesService } from '../../@core/services';
import { TranslateService } from '@ngx-translate/core';
import {
	IGetTimeLogInput,
	Organization,
	OrganizationAwards,
	OrganizationLanguages,
	PermissionsEnum,
	Timesheet
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { PublicPageMutationComponent } from '../../@shared/organizations/public-page-mutation/public-page-mutation.component';
import { OrganizationLanguagesService } from '../../@core/services/organization-languages.service';
import { OrganizationAwardsService } from '../../@core/services/organization-awards.service';
import * as moment from 'moment';
import { IncomeService } from '../../@core/services/income.service';
import { OrganizationClientsService } from '../../@core/services/organization-clients.service ';
import { EmployeeStatisticsService } from '../../@core/services/employee-statistics.service';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { TimesheetService } from '../../@shared/timesheet/timesheet.service';

@Component({
	selector: 'ngx-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: Organization;
	hasEditPermission = false;
	private _ngDestroy$ = new Subject<void>();

	organization_languages: OrganizationLanguages[];
	awards: OrganizationAwards[];
	loading = true;
	bonuses_paid = 0;
	total_clients = 0;
	total_income = 0;
	profits = 0;
	minimum_project_size = 0;
	total_projects = 0;
	employee_bonuses = [];
	employees = [];
	imageUrl: string;
	hoverState: boolean;
	languageExist: boolean;
	awardExist: boolean;
	imageUpdateButton: boolean = false;
	moment = moment;
	timeSheets: Timesheet[];

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private toastrService: NbToastrService,
		private employeesService: EmployeesService,
		private organization_language_service: OrganizationLanguagesService,
		private organizationAwardsService: OrganizationAwardsService,
		private incomeService: IncomeService,
		private organizationClientsService: OrganizationClientsService,
		private employeeStatisticsService: EmployeeStatisticsService,
		private organizationProjectsService: OrganizationProjectsService,
		private timesheetService: TimesheetService,
		private store: Store,
		private dialogService: NbDialogService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
		this.imageUpdateButton = true;
	}

	handleImageUploadError(event: any) {}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.PUBLIC_PAGE_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const profileLink = params.link;

				try {
					this.organization = await this.organizationsService
						.getByProfileLink(profileLink, null, ['skills'])
						.pipe(first())
						.toPromise();
					this.imageUrl = this.organization.imageUrl;
					this.reloadPageData();
					await this.getEmployeeStatistics();
					if (!!this.organization.show_clients_count) {
						await this.getClientsCount();
					}
					if (!!this.organization.show_projects_count) {
						await this.getProjectCount();
					}
					if (!!this.organization.show_total_hours) {
						await this.getTimeSheets();
					}
					await this.getEmployees();
				} catch (error) {
					await this.router.navigate(['/share/404']);
				}
			});
	}

	private async loadLanguages() {
		const res = await this.organization_language_service.getAll(
			{
				organizationId: this.organization.id
			},
			['language']
		);
		if (res) {
			this.organization_languages = res.items;
			this.languageExist = !!this.organization_languages.length;
		}
	}

	private async loadAwards() {
		const res = await this.organizationAwardsService.getAll({
			organizationId: this.organization.id
		});
		if (res) {
			this.awards = res.items;
			this.awardExist = !!this.awards.length;
		}
	}

	private async getClientsCount() {
		const { total } = await this.organizationClientsService.getAll(null, {
			organizationId: this.organization.id
		});
		this.total_clients = total;
	}

	private async getProjectCount() {
		const { items, total } = await this.organizationProjectsService.getAll(
			['members'],
			{
				organizationId: this.organization.id,
				public: true
			}
		);
		this.total_projects = total;
		if (total) {
			this.minimum_project_size = items[0].members.length;
			for (let inc = 0; inc < items.length; inc++) {
				if (items[inc].members.length < this.minimum_project_size) {
					this.minimum_project_size = items[inc].members.length;
				}
			}
		}
	}

	private async getEmployees() {
		let employees = await this.employeesService
			.getAll(['user'], {
				organization: {
					id: this.organization.id
				}
			})
			.pipe(first())
			.toPromise();
		this.employees = employees.items;

		if (typeof this.organization.totalEmployees !== 'number') {
			this.organization.totalEmployees = employees.total;
		}
	}

	private async getEmployeeBonuses() {
		let employeeBonuses = await this.incomeService.getAll(
			['employee', 'employee.user'],
			{
				organization: {
					id: this.organization.id
				},
				isBonus: true
			}
		);
		this.employee_bonuses = employeeBonuses.items.filter(
			(item) => !!item.employee.anonymousBonus
		);
	}

	private async getTimeSheets() {
		const request: IGetTimeLogInput = {
			organizationId: this.organization.id
		};
		this.loading = true;
		this.timeSheets = await this.timesheetService
			.getTimeSheets(request)
			.then((logs) => logs)
			.finally(() => (this.loading = false));
	}

	private async getEmployeeStatistics() {
		let statistics = await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId(
			{
				organizationId: this.organization.id,
				filterDate: new Date()
			}
		);

		if (!!this.organization.show_bonuses_paid) {
			this.bonuses_paid = statistics.total.bonus;
		}
		if (!!this.organization.show_income) {
			this.total_income = statistics.total.income;
		}
		if (!!this.organization.show_profits) {
			this.profits = statistics.total.profit;
		}
	}

	private reloadPageData() {
		this.loadAwards();
		this.loadLanguages();
	}

	async saveImage(organization: any) {
		await this.organizationsService.update(
			this.organization.id,
			organization
		);
		this.imageUpdateButton = false;
		this.toastrService.primary('The image has been updated.', 'Success');
	}

	async editPage() {
		this.dialogService
			.open(PublicPageMutationComponent, {
				context: {
					organization: this.organization
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (!!result) {
					await this.organizationsService.update(
						this.organization.id,
						result
					);
					Object.assign(this.organization, result);
					this.reloadPageData();
					this.toastrService.primary(
						this.organization.name + ' page is updated.',
						'Success'
					);
				}
			});
	}

	ngOnDestroy() {}
}
