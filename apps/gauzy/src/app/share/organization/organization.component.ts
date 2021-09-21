import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
	IOrganization,
	IOrganizationAward,
	IOrganizationLanguage,
	PermissionsEnum,
	IOrganizationContact
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { first, tap } from 'rxjs/operators';
import * as moment from 'moment';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { PublicPageMutationComponent } from '../../@shared/organizations/public-page-mutation/public-page-mutation.component';
import {
	EmployeesService,
	EmployeeStatisticsService,
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationsService,
	Store,
	ToastrService,
	UsersOrganizationsService
} from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: IOrganization;
	hasEditPermission = false;
	belongsToOrganization = false;
	organizationLanguages: IOrganizationLanguage[];
	awards: IOrganizationAward[];
	clients: IOrganizationContact[];
	bonusesPaid = 0;
	totalClients = 0;
	totalIncome = 0;
	profits = 0;
	totalProjects = 0;
	totalEmployees = 0;
	employees = [];
	imageUrl: string;
	hoverState: boolean;
	languageExist: boolean;
	awardExist: boolean;
	imageUpdateButton = false;
	moment = moment;
	tabTitle = 'Profile';
	tenantId: string;
	profileLink: string;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private userOrganizationService: UsersOrganizationsService,
		private toastrService: ToastrService,
		private employeesService: EmployeesService,
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
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.PUBLIC_PAGE_EDIT
				);
			});
		this.route.params.pipe(untilDestroyed(this)).subscribe((params) => {
			this.profileLink = params.link;
			this.getPublicOrganization();
		});
	}

	private async getPublicOrganization() {
		try {
			this.organization = await this.organizationsService
				.getByProfileLink(this.profileLink, null, [
					'skills',
					'awards',
					'languages',
					'languages.language'
				])
				.pipe(first())
				.toPromise();

			this.tenantId = this.store.user.tenantId;
			if (this.store.userId) {
				const { total } = await this.userOrganizationService.getAll(
					[],
					{
						userId: this.store.userId,
						organizationId: this.organization.id,
						tenantId: this.tenantId
					}
				);
				this.belongsToOrganization = total > 0;
			}

			this.imageUrl = this.organization.imageUrl;

			this.organizationLanguages = this.organization.languages;
			this.languageExist = !!this.organizationLanguages.length;

			this.awards = this.organization.awards;
			this.awardExist = !!this.awards.length;

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
		} catch (error) {
			await this.router.navigate(['/share/404']);
		}
	}

	private async getClientsAndClientsCount() {
		const { tenantId } = this;
		const { id: organizationId } = this.organization;

		const {
			total,
			items = []
		} = await this.organizationContactService.getAll(null, {
			organizationId,
			tenantId
		});
		this.totalClients = total;
		this.clients = items;
	}

	private async getProjectCount() {
		const { tenantId } = this;
		const { id: organizationId } = this.organization;

		const { total } = await this.organizationProjectsService.getAll(
			['members'],
			{ organizationId, tenantId, public: true }
		);
		this.totalProjects = total;
	}

	private async getEmployees() {
		const { tenantId } = this;
		const { id: organizationId } = this.organization;

		const employees = await this.employeesService
			.getAllPublic(['user', 'skills', 'organization'], {
				organizationId,
				tenantId
			})
			.pipe(first())
			.toPromise();

		this.employees = employees.items;
		this.totalEmployees = employees.total;

		if (typeof this.organization.totalEmployees !== 'number') {
			this.organization.totalEmployees = employees.total;
		}
	}

	private async getEmployeeStatistics() {
		const { tenantId } = this;
		const { id: organizationId } = this.organization;

		const statistics = await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId(
			{
				organizationId,
				tenantId,
				filterDate: new Date()
			}
		);
		if (!!this.organization.show_bonuses_paid) {
			this.bonusesPaid = statistics.total.bonus;
		}
		if (!!this.organization.show_income) {
			this.totalIncome = statistics.total.income;
		}
		if (!!this.organization.show_profits) {
			this.profits = statistics.total.profit;
		}
	}

	async saveImage(organization: any) {
		await this.organizationsService.update(
			this.organization.id,
			organization
		);
		this.imageUpdateButton = false;
		this.toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
	}

	createSlug(name : string) {		
		name = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
		return name;
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
				untilDestroyed(this)
			)
			.subscribe(async (result) => {
				if (!!result) {
					await this.organizationsService.update(
						this.organization.id,
						result
					);
					this.getPublicOrganization();
					this.toastrService.success(
						'TOASTR.MESSAGE.ORGANIZATION_PAGE_UPDATED',
						{
							name: this.organization.name
						}
					);
				}
			});
	}

	private _changeClientsTabIfActiveAndPrivacyIsTurnedOff() {
		if (
			!this.organization.show_clients &&
			this.tabTitle === this.getTranslation('ORGANIZATIONS_PAGE.CLIENTS')
		) {
			this.tabTitle = this.getTranslation('ORGANIZATIONS_PAGE.PROFILE');
		}
	}

	onTabChange(e) {
		this.tabTitle = e.tabTitle;
	}

	ngOnDestroy() {}
}
