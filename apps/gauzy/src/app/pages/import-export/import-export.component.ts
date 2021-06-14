import { Component, OnInit } from '@angular/core';
import { saveAs } from 'file-saver';
import { Router, UrlSerializer } from '@angular/router';
import { concatMap, filter, finalize, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ITenant, IAuthResponse, IOrganization, IOrganizationCreateInput, IUser, IUserRegistrationInput, PermissionsEnum, BonusTypeEnum, CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/contracts';
import { ExportAllService } from '../../@core/services/export-all.service';
import { environment } from './../../../environments/environment';
import { Environment } from './../../../environments/model';
import { GauzyCloudService, Store, ToastrService } from '../../@core/services';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-import-export',
	templateUrl: './import-export.html'
})
export class ImportExportComponent extends TranslationBaseComponent implements OnInit {

	organization: IOrganization;
	user: IUser;
	environment: Environment = environment;
	permissionsEnum = PermissionsEnum;
	loading: boolean;
	token: string;
	gauzyUser: IUser;

	constructor(
		private readonly exportAll: ExportAllService,
		private readonly gauzyCloudService: GauzyCloudService,
		private readonly router: Router,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly serializer: UrlSerializer
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
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
			.downloadTemplates()
			.pipe(untilDestroyed(this))
			.subscribe((data) => saveAs(data, `template.zip`));
	}

	/*
	* Migrate Self Hosted to Gauzy Cloud Hosted
	*/
	onMigrateIntoCloud(password: string) {
		this.loading = true;
		const { 
			firstName,
			lastName,
			email,
			imageUrl,
			preferredComponentLayout,
			preferredLanguage,
			tenant: { name } 
		} = this.user;
		const register: IUserRegistrationInput = {
			user: { 
				firstName, 
				lastName, 
				email,
				preferredComponentLayout,
				preferredLanguage,
				imageUrl
			},
			password
		}

		try {
			this.gauzyCloudService.migrateIntoCloud(register)
				.pipe(
					switchMap((response: IAuthResponse) => {
						const { token, user } = response;
						this.token = token;
						this.gauzyUser = user;
						return this.gauzyCloudService.migrateTenant({ name }, token);
					}),
					concatMap((tenant: ITenant) => {
						return this.gauzyCloudService.migrateOrganization(
							{ ...this.mapOrganization(this.organization, tenant) }, 
							this.token
						);
					}),
					tap(() => {
						this.toastrService.success('MENU.IMPORT_EXPORT.MIGRATE_SUCCESSFULLY', {
							tenant: name
						});
					}),
					finalize(() => {
						this.loading = false;
						const externalUrl = environment.GAUZY_CLOUD_APP;
						const tree = this.router.createUrlTree([], { 
							queryParams: { 
								token: this.token,
								userId: this.gauzyUser.id
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
						}, 1000);	
					}),
					untilDestroyed(this),
				)
				.subscribe();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	mapOrganization(
		organization: IOrganization,
		tenant: ITenant
	): IOrganizationCreateInput {
		const { currency, defaultValueDateType, bonusType, imageUrl } = organization;
		return {
			...organization,
			imageUrl,
			tenant,
			tenantId: tenant.id,
			currency: currency as CurrenciesEnum, 
			defaultValueDateType: defaultValueDateType as DefaultValueDateTypeEnum, 
			bonusType: bonusType as BonusTypeEnum,
		}
	}
}