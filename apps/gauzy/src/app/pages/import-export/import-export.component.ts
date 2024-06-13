import { Component, OnInit } from '@angular/core';
import { saveAs } from 'file-saver';
import { Router, UrlSerializer } from '@angular/router';
import { catchError, concatMap, delay, filter, finalize, switchMap, tap } from 'rxjs/operators';
import { EMPTY, firstValueFrom, of as observableOf } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ITenant,
	IAuthResponse,
	IOrganization,
	IOrganizationCreateInput,
	IUser,
	IUserRegistrationInput,
	PermissionsEnum,
	BonusTypeEnum,
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	ImportTypeEnum,
	IUserOrganization
} from '@gauzy/contracts';
import { Environment, environment } from '@gauzy/ui-config';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ErrorHandlingService, ToastrService, UsersOrganizationsService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { ExportAllService, GauzyCloudService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-import-export',
	templateUrl: './import-export.html',
	styleUrls: ['./import-export.component.scss']
})
export class ImportExportComponent extends TranslationBaseComponent implements OnInit {
	user: IUser;
	environment: Environment = environment;
	permissionsEnum = PermissionsEnum;
	loading: boolean;
	token: string;
	gauzyUser: IUser;
	userOrganizations: IUserOrganization[] = [];

	constructor(
		private readonly exportAll: ExportAllService,
		private readonly gauzyCloudService: GauzyCloudService,
		private readonly userOrganizationService: UsersOrganizationsService,
		private readonly router: Router,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly serializer: UrlSerializer,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.getOrganizations()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	importPage() {
		this.router.navigate(['/pages/settings/import-export/import']);
	}

	exportPage() {
		this.router.navigate(['/pages/settings/import-export/export']);
	}

	onDownloadTemplates() {
		this.exportAll
			.downloadExportTemplates()
			.pipe(untilDestroyed(this))
			.subscribe((data) => saveAs(data, `archive.zip`));
	}

	/*
	 * Migrate Self Hosted to Gauzy Cloud Hosted
	 */
	onMigrateIntoCloud(password: string) {
		const {
			id: sourceId,
			firstName,
			lastName,
			username,
			thirdPartyId,
			email,
			imageUrl,
			preferredComponentLayout,
			preferredLanguage,
			tenant: { id: tenantId, name }
		} = this.user;
		const register: IUserRegistrationInput = {
			user: {
				firstName,
				lastName,
				username,
				thirdPartyId,
				email,
				preferredComponentLayout,
				preferredLanguage,
				imageUrl
			},
			isImporting: true,
			sourceId,
			password,
			confirmPassword: password
		};

		this.loading = true;
		try {
			this.gauzyCloudService
				.migrateIntoCloud(register)
				.pipe(
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return observableOf(EMPTY);
					}),
					switchMap((response: IAuthResponse) => {
						if (response) {
							if (response['status']) {
								const statuses = [400, 404];
								if (statuses.includes(response['status'])) {
									this._errorHandlingService.handleError(response);
									return EMPTY;
								}
							}
							const { token, user } = response;
							this.token = token;
							this.gauzyUser = user;
							return this.gauzyCloudService.migrateTenant(
								{
									name,
									isImporting: true,
									sourceId: tenantId,
									userSourceId: sourceId
								},
								token
							);
						}
						return EMPTY;
					}),
					delay(1000),
					concatMap(async (tenant: ITenant) => {
						if (tenant) {
							for await (const { id: userOrganizationSourceId, organization } of this.userOrganizations) {
								await firstValueFrom(
									this.gauzyCloudService.migrateOrganization(
										{
											...this.mapOrganization(organization, tenant, userOrganizationSourceId)
										},
										this.token
									)
								);
							}
							return await firstValueFrom(observableOf(tenant));
						}
						return await firstValueFrom(observableOf(EMPTY));
					}),
					tap({
						next: (x) => {
							this.toastrService.success('MENU.IMPORT_EXPORT.MIGRATE_SUCCESSFULLY', {
								tenant: name
							});
							const externalUrl = environment.GAUZY_CLOUD_APP;
							const tree = this.router.createUrlTree(['/pages/settings/import-export/import'], {
								queryParams: {
									token: this.token,
									userId: this.gauzyUser.id,
									importType: ImportTypeEnum.MERGE
								}
							});
							let redirect: string;
							if (externalUrl.indexOf('#') !== -1) {
								redirect = externalUrl + '' + this.serializer.serialize(tree);
							} else {
								redirect = externalUrl + '/#' + this.serializer.serialize(tree);
							}
							setTimeout(() => {
								this.router.navigate(['/pages/settings/import-export/external-redirect', { redirect }]);
							}, 1500);
						},
						error: (err) => {
							this._errorHandlingService.handleError(err);
						}
					}),
					finalize(() => (this.loading = false)),
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async getOrganizations() {
		const { id: userId, tenantId } = this.user;
		const { items = [] } = await this.userOrganizationService.getAll(['organization', 'organization.contact'], {
			userId,
			tenantId
		});
		this.userOrganizations = items;
	}

	mapOrganization(
		organization: IOrganization,
		tenant: ITenant,
		userOrganizationSourceId: IUserOrganization['id']
	): IOrganizationCreateInput {
		const { currency, defaultValueDateType, bonusType, imageUrl, id: sourceId } = organization;
		delete organization['id'];
		delete organization['contactId'];

		return {
			...organization,
			imageUrl,
			tenant,
			tenantId: tenant.id,
			currency: currency as CurrenciesEnum,
			defaultValueDateType: defaultValueDateType as DefaultValueDateTypeEnum,
			bonusType: bonusType as BonusTypeEnum,
			isImporting: true,
			sourceId,
			userOrganizationSourceId
		};
	}
}
