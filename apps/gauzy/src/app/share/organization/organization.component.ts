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
	PermissionsEnum
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
	imageUrl: string;
	hoverState: boolean;
	languageExist: boolean;
	awardExist: boolean;
	imageUpdateButton: boolean = false;
	moment = moment;

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
					if (typeof this.organization.totalEmployees !== 'number') {
						this.loadEmployeesCount();
					}
					if (!!this.organization.show_bonuses_paid) {
						this.getTotalBonusesPaid();
					}
					if (!!this.organization.show_clients_count) {
						this.getClientsCount();
					}
					this.reloadPageData();
				} catch (error) {
					await this.router.navigate(['/share/404']);
				}
			});
	}

	private async loadEmployeesCount() {
		const { total } = await this.employeesService
			.getAll([], {
				organization: {
					id: this.organization.id
				}
			})
			.pipe(first())
			.toPromise();
		this.organization.totalEmployees = total;
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

			if (this.organization_languages.length <= 0) {
				this.languageExist = false;
			} else {
				this.languageExist = true;
			}
		}
	}

	private async loadAwards() {
		const res = await this.organizationAwardsService.getAll({
			organizationId: this.organization.id
		});
		if (res) {
			this.awards = res.items;

			if (this.awards.length <= 0) {
				this.awardExist = false;
			} else {
				this.awardExist = true;
			}
		}
	}

	private async getTotalBonusesPaid() {
		let { items } = await this.incomeService.getAll(['employee'], {
			organization: {
				id: this.organization.id
			}
		});

		for (let inc = 0; inc < items.length; inc++) {
			if (items[inc].employee && items[inc].employee.anonymousBonus) {
				this.bonuses_paid += parseFloat(String(items[inc].amount));
			}
		}
	}

	private async getClientsCount() {
		const { total } = await this.organizationClientsService.getAll(null, {
			organizationId: this.organization.id
		});
		this.total_clients = total;
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
