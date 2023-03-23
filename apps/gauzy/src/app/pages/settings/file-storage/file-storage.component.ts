import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FileStorageProviderEnum, ITenantSetting, IUser, PermissionsEnum, SMTPSecureEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { isNotEmpty } from '@gauzy/common-angular';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { FileStorageService, Store, TenantService, ToastrService } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { environment } from './../../../../environments/environment';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-file-storage',
	templateUrl: './file-storage.component.html',
	styleUrls: ['./file-storage.component.scss'],
	providers: [FileStorageService, TenantService]
})
export class FileStorageComponent extends TranslationBaseComponent
	implements OnInit {

	secureOptions = [
		{ label: SMTPSecureEnum.TRUE, value: "true" },
		{ label: SMTPSecureEnum.FALSE, value: "false" }
	];
	PermissionsEnum = PermissionsEnum;
	FileStorageProviderEnum = FileStorageProviderEnum;
	user: IUser;
	settings: ITenantSetting = new Object();

	public readonly form: FormGroup = FileStorageComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		const form = fb.group({
			fileStorageProvider: [
				(environment.FILE_PROVIDER).toUpperCase() as FileStorageProviderEnum || FileStorageProviderEnum.LOCAL,
				Validators.required
			],
			// Aws Configuration
			S3: fb.group({
				aws_access_key_id: [],
				aws_secret_access_key: [],
				aws_default_region: [],
				aws_bucket: []
			}),
			// Wasabi Configuration
			WASABI: fb.group({
				wasabi_aws_access_key_id: [],
				wasabi_aws_secret_access_key: [],
				wasabi_aws_default_region: ['us-east-1'],
				wasabi_aws_service_url: ['s3.wasabisys.com'],
				wasabi_aws_bucket: ['gauzy']
			}),
			// Cloudinary Configuration
			CLOUDINARY: fb.group({
				cloudinary_cloud_name: [],
				cloudinary_api_key: [],
				cloudinary_api_secret: [],
				cloudinary_api_secure: [],
				cloudinary_delivery_url: []
			}),
		});
		return form;
	}

	public subject$: Subject<boolean> = new Subject();

	/*
	* Getter for file storage provider
	*/
	get fileStorageProvider() {
		return this.form.get('fileStorageProvider').value;
	}

	constructor(
		public readonly translate: TranslateService,
		private readonly tenantService: TenantService,
		private readonly fileStorageService: FileStorageService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly fb: FormBuilder,
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				tap(() => this.getSetting()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap(() => this.subject$.next(true)),
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
			const { fileStorageProvider } = settings;
			this.setFileStorageProvider(fileStorageProvider);

			if (this.form.contains(fileStorageProvider)) {
				this.form.get(fileStorageProvider).patchValue({ ...settings });
				this.form.get(fileStorageProvider).updateValueAndValidity();
			}
		} else {
			this.setFileStorageProvider((environment.FILE_PROVIDER.toUpperCase() as FileStorageProviderEnum) || FileStorageProviderEnum.LOCAL);
		}
	}

	/**
	 * SAVE current tenant file storage setting
	 */
	async submit() {
		if (this.form.invalid) {
			return;
		}

		let settings: ITenantSetting;

		const { fileStorageProvider = FileStorageProviderEnum.LOCAL } = this.form.getRawValue();
		const filesystem: ITenantSetting = this.form.getRawValue();

		/**
		 * If driver is available else use LOCAL file storage
		 */
		if (fileStorageProvider in filesystem) {
			settings = {
				fileStorageProvider,
				...filesystem[fileStorageProvider]
			}
		} else {
			settings = {
				fileStorageProvider: FileStorageProviderEnum.LOCAL
			}
		}

		try {
			if (fileStorageProvider === FileStorageProviderEnum.WASABI) {
				await this.fileStorageService.validateWasabiCredentials(settings);

				this.toastrService.success('TOASTR.MESSAGE.BUCKET_CREATED', {
					bucket: `${this.settings.wasabi_aws_bucket}`,
					region: `${this.settings.wasabi_aws_default_region}`
				});
			}
		} catch (error) {
			this.toastrService.danger(error);
			return;
		}

		try {
			await this.tenantService.saveSettings(settings);
			this.toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/**
	 * Set file storage provider for formcontrol
	 *
	 * @param provider
	 */
	setFileStorageProvider(provider: FileStorageProviderEnum) {
		this.form.get('fileStorageProvider').setValue(provider);
		this.form.get('fileStorageProvider').updateValueAndValidity();
	}
}
