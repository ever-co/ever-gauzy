import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { ActivatedRoute, Router } from '@angular/router';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { EmployeesService } from '../../@core/services';
import { TranslateService } from '@ngx-translate/core';
import {
	Organization,
	OrganizationAwards,
	OrganizationLanguages,
	PermissionsEnum,
	OrganizationContact
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { first, takeUntil, tap } from 'rxjs/operators';
import { PublicPageMutationComponent } from '../../@shared/organizations/public-page-mutation/public-page-mutation.component';
import { OrganizationLanguagesService } from '../../@core/services/organization-languages.service';
import { OrganizationAwardsService } from '../../@core/services/organization-awards.service';
import * as moment from 'moment';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { EmployeeStatisticsService } from '../../@core/services/employee-statistics.service';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';

export enum CURRENCY {
	USD = '$',
	BGN = 'Лв',
	ILS = '₪'
}

@Component({
	selector: 'ngx-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: Organization;
	hasEditPermission = false;
	belongsToOrganization = false;

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
	total_employees = 0;
	employee_bonuses = [];
	employees = [];
	imageUrl: string;
	hoverState: boolean;
	languageExist: boolean;
	awardExist: boolean;
	imageUpdateButton = false;
	moment = moment;
	currencies = Object.values(CURRENCY);
	clients: OrganizationContact[];
	tabTitle: string = 'Profile';

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private userOrganizationService: UsersOrganizationsService,
		private toastrService: NbToastrService,
		private employeesService: EmployeesService,
		private organization_language_service: OrganizationLanguagesService,
		private organizationAwardsService: OrganizationAwardsService,
		private organizationContactService: OrganizationContactService,
		private employeeStatisticsService: EmployeeStatisticsService,
		private organizationProjectsService: OrganizationProjectsService,
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

					if (this.store.userId) {
						const {
							total
						} = await this.userOrganizationService.getAll([], {
							userId: this.store.userId,
							organizationId: this.organization.id
						});
						this.belongsToOrganization = total > 0;
					}

					this.imageUrl = this.organization.imageUrl;
					this.reloadPageData();
					await this.getEmployeeStatistics();
					if (
						!!this.organization.show_clients_count ||
						this.organization.show_clients
					) {
						await this.getClientsAndClientsCount();
					}
					if (!!this.organization.show_employees_count) {
						await this.getEmployees();
					}
					if (!!this.organization.show_projects_count) {
						await this.getProjectCount();
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

	private async getClientsAndClientsCount() {
		const { total, items } = await this.organizationContactService.getAll(
			null,
			{
				organizationId: this.organization.id
			}
		);
		this.total_clients = total;
		this.clients = items;
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
		const employees = await this.employeesService
			.getAllPublic(['user', 'skills', 'organization'], {
				organization: {
					id: this.organization.id
				}
			})
			.pipe(first())
			.toPromise();
		this.employees = employees.items;
		this.total_employees = employees.total;

		if (typeof this.organization.totalEmployees !== 'number') {
			this.organization.totalEmployees = employees.total;
		}
	}

	private async getEmployeeStatistics() {
		const statistics = await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId(
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
			.onClose.pipe(
				tap(() =>
					this._changeClientsTabIfActiveAndPrivacyIsTurnedOff()
				),
				takeUntil(this._ngDestroy$)
			)
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

	private _changeClientsTabIfActiveAndPrivacyIsTurnedOff() {
		if (!this.organization.show_clients && this.tabTitle === 'Clients') {
			this.tabTitle = 'Profile';
		}
	}

	onTabChange(e) {
		this.tabTitle = e.tabTitle;
	}

	ngOnDestroy() {}
}
