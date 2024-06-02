import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '@gauzy/ui-config';
import {
	FileStorageProviderEnum,
	HttpStatus,
	ITenantSetting,
	IUser,
	PermissionsEnum,
	SMTPSecureEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/ui-sdk/common';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-sdk/core';
import { FileStorageService, Store, TenantService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-file-storage',
	templateUrl: './file-storage.component.html',
	styleUrls: ['./file-storage.component.scss'],
	providers: [FileStorageService, TenantService]
})
export class FileStorageComponent extends TranslationBaseComponent implements OnInit {
	secureOptions = [
		{ label: SMTPSecureEnum.TRUE, value: 'true' },
		{ label: SMTPSecureEnum.FALSE, value: 'false' }
	];
	PermissionsEnum = PermissionsEnum;
	FileStorageProviderEnum = FileStorageProviderEnum;
	user: IUser;
	settings: ITenantSetting = new Object();
	loading: boolean = false;

	public readonly form: UntypedFormGroup = FileStorageComponent.buildForm(this._fb);

	/**
	 *
	 * @param fb
	 * @returns
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const defaultFileStorageProvider =
			(environment.FILE_PROVIDER.toUpperCase() as FileStorageProviderEnum) || FileStorageProviderEnum.LOCAL;
		//
		const form = fb.group({
			fileStorageProvider: [defaultFileStorageProvider, Validators.required],
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
				wasabi_aws_service_url: ['https://s3.wasabisys.com'],
				wasabi_aws_bucket: ['gauzy'],
				wasabi_aws_force_path_style: [true]
			}),
			// DigitalOcean Configuration
			DIGITALOCEAN: fb.group({
				digitalocean_access_key_id: [],
				digitalocean_secret_access_key: [],
				digitalocean_default_region: [{ value: 'us-east-1', disabled: true }],
				digitalocean_service_url: [],
				digitalocean_cdn_url: [],
				digitalocean_s3_bucket: ['gauzy'],
				digitalocean_s3_force_path_style: [true]
			}),
			// Cloudinary Configuration
			CLOUDINARY: fb.group({
				cloudinary_cloud_name: [],
				cloudinary_api_key: [],
				cloudinary_api_secret: [],
				cloudinary_api_secure: ['true'],
				cloudinary_delivery_url: ['https://res.cloudinary.com']
			})
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
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _tenantService: TenantService,
		private readonly _fileStorageService: FileStorageService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translate);
	}

	ngOnInit(): void {
		combineLatest([
			this.subject$.pipe(tap(() => this.getSetting())),
			this._store.user$.pipe(
				filter((user: IUser) => !!user),
				tap(() => this.subject$.next(true))
			)
		])
			.pipe(untilDestroyed(this))
			.subscribe();
	}

	/**
	 * Retrieves the current tenant's file storage settings.
	 * If settings are available, updates the file storage provider accordingly.
	 * If no settings are available, uses the default file storage provider from the environment.
	 */
	async getSetting(): Promise<void> {
		try {
			this.loading = true; // Set loading state to true while fetching settings

			// Fetch tenant settings
			const settings = (this.settings = await this._tenantService.getSettings());

			// Determine the default file storage provider
			const defaultFileStorageProvider =
				(environment.FILE_PROVIDER.toUpperCase() as FileStorageProviderEnum) || FileStorageProviderEnum.LOCAL;

			// Update file storage provider based on fetched settings or use the default one
			const fileStorageProvider = isNotEmpty(settings)
				? settings.fileStorageProvider
				: defaultFileStorageProvider;
			this.setFileStorageProvider(fileStorageProvider);
		} catch (error) {
			console.error('Error fetching tenant settings:', error); // Log the error
			// You can add more specific error handling here if needed
		} finally {
			this.loading = false; // Set loading state to false once fetching is complete
		}
	}

	/**
	 * SAVE current tenant file storage setting
	 */
	async submit() {
		try {
			if (this.form.invalid) {
				return;
			}

			// Extract the file storage provider and settings from the form data
			const { fileStorageProvider = FileStorageProviderEnum.LOCAL, ...filesystem } = this.form.getRawValue();

			// Construct the settings object with the extracted data
			const settings: ITenantSetting = {
				fileStorageProvider,
				...(fileStorageProvider in filesystem ? filesystem[fileStorageProvider] : {})
			};

			// Validates Wasabi credentials if the selected file storage provider is Wasabi.
			if (fileStorageProvider === FileStorageProviderEnum.WASABI) {
				const response = await this._fileStorageService.validateWasabiCredentials(settings);
				// Handles errors with the HTTP status code HttpStatus.BAD_REQUEST.
				if (response.status === HttpStatus.BAD_REQUEST) {
					this._errorHandlingService.handleError(response);
					return;
				}

				this._toastrService.success('TOASTR.MESSAGE.BUCKET_CREATED', {
					bucket: `${settings.wasabi_aws_bucket}`,
					region: `${settings.wasabi_aws_default_region}`
				});
			}

			// Saves the tenant settings and displays a success message upon successful saving.
			await this._tenantService.saveSettings(settings);
			this._toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			console.error('Error while submitting tenant settings:', error);
			this._toastrService.danger('An error occurred while saving settings. Please try again.');
		} finally {
			this.subject$.next(true);
		}
	}

	/**
	 * Set file storage provider for formcontrol
	 *
	 * @param provider
	 */
	setFileStorageProvider(provider: FileStorageProviderEnum) {
		const fileStorageProviderControl = this.form.get('fileStorageProvider');

		fileStorageProviderControl.setValue(provider);
		fileStorageProviderControl.updateValueAndValidity();

		const providerControl = this.form.get(provider);
		if (providerControl) {
			providerControl.patchValue({ ...this.settings });
			providerControl.updateValueAndValidity();
		}
	}
}
