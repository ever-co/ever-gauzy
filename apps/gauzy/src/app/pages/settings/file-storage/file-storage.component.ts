import { Component, OnInit } from '@angular/core';
import { FileStorageProviderEnum, ITenantSetting, IUser, IWasabiFileStorageProviderConfig } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { isNotEmpty } from '@gauzy/common-angular';
import { filter, tap } from 'rxjs/operators';
import { FileStorageService, Store, TenantService, ToastrService } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { environment } from './../../../../environments/environment';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-file-storage',
	templateUrl: './file-storage.component.html',
	providers: [FileStorageService, TenantService]
})
export class FileStorageComponent
	extends TranslationBaseComponent
	implements OnInit {

	user: IUser;
	settings: ITenantSetting = new Object();
	fileStorageProviderEnum = FileStorageProviderEnum;
	fileStorageProviders: { label: string; value: any }[];

	constructor(
		public readonly translate: TranslateService,
		private readonly tenantService: TenantService,
		private readonly fileStorageService: FileStorageService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translate);
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.getSetting()),
				tap(() => this.getFileStorageProviders()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * GET file storage providers
	 */
	getFileStorageProviders() {
		this.fileStorageProviders = Object.keys(FileStorageProviderEnum).map(
			(label) => ({
				label,
				value: FileStorageProviderEnum[label]
			})
		);
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
				fileStorageProvider: environment.FILE_PROVIDER as FileStorageProviderEnum || FileStorageProviderEnum.LOCAL,
				...this.defaultWasabiConfiguration()
			}
		}
	}

	/**
	 * SAVE current tenant file storage setting
	 */
	async submit() {
		try {
			let settings: ITenantSetting;
			let keysOfPros = [];

			if (this.settings.fileStorageProvider === FileStorageProviderEnum.LOCAL) {
				settings = {
					fileStorageProvider: FileStorageProviderEnum.LOCAL
				}
			} else if (this.settings.fileStorageProvider === FileStorageProviderEnum.WASABI) {
				settings = {
					fileStorageProvider: FileStorageProviderEnum.WASABI,
				};
				keysOfPros.push(...[
					'wasabi_aws_access_key_id', 'wasabi_aws_secret_access_key',
					'wasabi_aws_default_region', 'wasabi_aws_service_url', 'wasabi_aws_bucket'
				]);
			} else {
				settings = {
					fileStorageProvider: FileStorageProviderEnum.S3,
				};
				keysOfPros.push(...[
					'aws_access_key_id', 'aws_secret_access_key',
					'aws_default_region', 'aws_bucket'
				]);
			}
			for (const prop of keysOfPros) {
				settings[prop] = this.settings[prop];
			}

			try {
				await this.tenantService.saveSettings(settings);
				this.toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
			} catch (error) {
				this.toastrService.danger(error);
			}
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

	async validateWasabi() {
		try {
			await this.fileStorageService.validateWasabiCredentials(this.settings);
			console.log(this.fileStorageService, this.settings);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}
}
