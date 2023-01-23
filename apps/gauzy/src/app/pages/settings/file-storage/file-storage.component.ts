import { Component, OnInit } from '@angular/core';
import { FileStorageProviderEnum, ITenantSetting, IUser, IWasabiFileStorageProviderConfig, PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { isNotEmpty } from '@gauzy/common-angular';
import { filter, tap } from 'rxjs/operators';
import { FileStorageService, Store, TenantService, ToastrService } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { environment } from './../../../../environments/environment';
import { HttpStatusCode } from '@angular/common/http';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-file-storage',
	templateUrl: './file-storage.component.html',
	styleUrls: ['./file-storage.component.scss'],
	providers: [FileStorageService, TenantService]
})
export class FileStorageComponent extends TranslationBaseComponent
	implements OnInit {

	PermissionsEnum = PermissionsEnum;
	FileStorageProviderEnum = FileStorageProviderEnum;
	user: IUser;
	settings: ITenantSetting = new Object();

	constructor(
		public readonly translate: TranslateService,
		private readonly tenantService: TenantService,
		private readonly fileStorageService: FileStorageService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.getSetting()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * GET current tenant file storage setting
	 */
	async getSetting() {
		const settings = await this.tenantService.getSettings();
		if (isNotEmpty(settings)) {
			this.settings = Object.assign({}, this.defaultWasabiConfiguration(), settings);
		} else {
			this.settings = {
				fileStorageProvider: (environment.FILE_PROVIDER).toUpperCase() as FileStorageProviderEnum || FileStorageProviderEnum.LOCAL,
				...this.defaultWasabiConfiguration()
			}
		}
	}

	/**
	 * SAVE current tenant file storage setting
	 */
	async submit() {
		let settings: ITenantSetting;
		let properties = [];

		const { fileStorageProvider = FileStorageProviderEnum.LOCAL } = this.settings;

		if (fileStorageProvider === FileStorageProviderEnum.WASABI) {
			settings = {
				fileStorageProvider: FileStorageProviderEnum.WASABI,
			};
			properties.push(...[
				'wasabi_aws_access_key_id',
				'wasabi_aws_secret_access_key',
				'wasabi_aws_default_region',
				'wasabi_aws_service_url',
				'wasabi_aws_bucket'
			]);

			const { wasabi_aws_bucket, wasabi_aws_default_region } = this.settings;
			const validated = await this.fileStorageService.validateWasabiCredentials(this.settings);

			if (validated.status == HttpStatusCode.Forbidden) {
				this.toastrService.danger(validated);
				return;
			} else {
				this.toastrService.success('TOASTR.MESSAGE.BUCKET_CREATED', {
					bucket: `${wasabi_aws_bucket}`,
					region: `${wasabi_aws_default_region}`
				});
			}
		} else if (fileStorageProvider === FileStorageProviderEnum.S3) {
			settings = {
				fileStorageProvider: FileStorageProviderEnum.S3,
			};
			properties.push(...[
				'aws_access_key_id', 'aws_secret_access_key',
				'aws_default_region', 'aws_bucket'
			]);
		} else if (fileStorageProvider === FileStorageProviderEnum.CLOUDINARY) {
			settings = {
				fileStorageProvider: FileStorageProviderEnum.CLOUDINARY,
			};
			properties.push(...[
				'cloudinary_cloud_name',
				'cloudinary_api_key',
				'cloudinary_api_secret'
			]);
		} else {
			settings = {
				fileStorageProvider: FileStorageProviderEnum.LOCAL
			}
		}

		for (const prop of properties) {
			settings[prop] = this.settings[prop];
		}

		try {
			await this.tenantService.saveSettings(settings);
			this.toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/**
	 * Default Wasabi Provider Configuration
	 *
	 */
	defaultWasabiConfiguration(): IWasabiFileStorageProviderConfig {
		return {
			wasabi_aws_default_region: 'us-east-1',
			wasabi_aws_service_url: 's3.wasabisys.com',
			wasabi_aws_bucket: 'gauzy'
		}
	}
}
