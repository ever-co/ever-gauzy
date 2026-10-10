import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
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
import { isNotEmpty } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ErrorHandlingService, Store, ToastrService } from '@gauzy/ui-core/core';
import { FileStorageService, TenantService } from '@gauzy/ui-core/core';

/**
 * Where each cloud provider keeps the values the summary and the configuration check look at.
 * Field names are the form control names, which are also the tenant setting names.
 */
interface IProviderFieldMap {
	bucket?: string;
	region?: string;
	endpoint?: string;
	credentials: string[];
	required: { control: string; label: string }[];
	urls: { control: string; label: string }[];
	docsUrl: string;
}

const PROVIDER_FIELDS: Partial<Record<FileStorageProviderEnum, IProviderFieldMap>> = {
	[FileStorageProviderEnum.S3]: {
		bucket: 'aws_bucket',
		region: 'aws_default_region',
		credentials: ['aws_access_key_id', 'aws_secret_access_key'],
		required: [
			{ control: 'aws_access_key_id', label: 'SETTINGS_FILE_STORAGE.S3.LABELS.ACCESS_KEY_ID' },
			{ control: 'aws_secret_access_key', label: 'SETTINGS_FILE_STORAGE.S3.LABELS.SECRET_ACCESS_KEY' },
			{ control: 'aws_default_region', label: 'SETTINGS_FILE_STORAGE.S3.LABELS.REGION' },
			{ control: 'aws_bucket', label: 'SETTINGS_FILE_STORAGE.S3.LABELS.BUCKET' }
		],
		urls: [],
		docsUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'
	},
	[FileStorageProviderEnum.WASABI]: {
		bucket: 'wasabi_aws_bucket',
		region: 'wasabi_aws_default_region',
		endpoint: 'wasabi_aws_service_url',
		credentials: ['wasabi_aws_access_key_id', 'wasabi_aws_secret_access_key'],
		required: [
			{ control: 'wasabi_aws_access_key_id', label: 'SETTINGS_FILE_STORAGE.WASABI.LABELS.ACCESS_KEY_ID' },
			{ control: 'wasabi_aws_secret_access_key', label: 'SETTINGS_FILE_STORAGE.WASABI.LABELS.SECRET_ACCESS_KEY' },
			{ control: 'wasabi_aws_default_region', label: 'SETTINGS_FILE_STORAGE.WASABI.LABELS.REGION' },
			{ control: 'wasabi_aws_service_url', label: 'SETTINGS_FILE_STORAGE.WASABI.LABELS.SERVICE_URL' },
			{ control: 'wasabi_aws_bucket', label: 'SETTINGS_FILE_STORAGE.WASABI.LABELS.BUCKET' }
		],
		urls: [{ control: 'wasabi_aws_service_url', label: 'SETTINGS_FILE_STORAGE.WASABI.LABELS.SERVICE_URL' }],
		docsUrl: 'https://docs.wasabi.com/'
	},
	[FileStorageProviderEnum.CLOUDINARY]: {
		bucket: 'cloudinary_cloud_name',
		endpoint: 'cloudinary_delivery_url',
		credentials: ['cloudinary_api_key', 'cloudinary_api_secret'],
		required: [
			{ control: 'cloudinary_cloud_name', label: 'SETTINGS_FILE_STORAGE.CLOUDINARY.LABELS.CLOUD_NAME' },
			{ control: 'cloudinary_api_key', label: 'SETTINGS_FILE_STORAGE.CLOUDINARY.LABELS.ACCESS_API_KEY' },
			{ control: 'cloudinary_api_secret', label: 'SETTINGS_FILE_STORAGE.CLOUDINARY.LABELS.ACCESS_API_SECRET' },
			{ control: 'cloudinary_delivery_url', label: 'SETTINGS_FILE_STORAGE.CLOUDINARY.LABELS.DELIVERY_URL' }
		],
		urls: [{ control: 'cloudinary_delivery_url', label: 'SETTINGS_FILE_STORAGE.CLOUDINARY.LABELS.DELIVERY_URL' }],
		docsUrl: 'https://cloudinary.com/documentation'
	},
	[FileStorageProviderEnum.DIGITALOCEAN]: {
		bucket: 'digitalocean_s3_bucket',
		region: 'digitalocean_default_region',
		endpoint: 'digitalocean_service_url',
		credentials: ['digitalocean_access_key_id', 'digitalocean_secret_access_key'],
		required: [
			{ control: 'digitalocean_access_key_id', label: 'SETTINGS_FILE_STORAGE.DIGITALOCEAN.LABELS.ACCESS_KEY_ID' },
			{
				control: 'digitalocean_secret_access_key',
				label: 'SETTINGS_FILE_STORAGE.DIGITALOCEAN.LABELS.SECRET_ACCESS_KEY'
			},
			{ control: 'digitalocean_service_url', label: 'SETTINGS_FILE_STORAGE.DIGITALOCEAN.LABELS.SERVICE_URL' },
			{ control: 'digitalocean_s3_bucket', label: 'SETTINGS_FILE_STORAGE.DIGITALOCEAN.LABELS.BUCKET' }
		],
		urls: [
			{ control: 'digitalocean_service_url', label: 'SETTINGS_FILE_STORAGE.DIGITALOCEAN.LABELS.SERVICE_URL' },
			{ control: 'digitalocean_cdn_url', label: 'SETTINGS_FILE_STORAGE.DIGITALOCEAN.LABELS.CDN_URL' }
		],
		docsUrl: 'https://docs.digitalocean.com/products/spaces/how-to/manage-access/'
	}
};

/**
 * Wasabi regions offered as suggestions on the region input (free text is still accepted).
 * Each region's endpoint is `https://s3.<region>.wasabisys.com`; us-east-1 keeps the
 * historical `https://s3.wasabisys.com`, which is also the form default.
 */
const WASABI_REGIONS = [
	'us-east-1',
	'us-east-2',
	'us-central-1',
	'us-west-1',
	'ca-central-1',
	'eu-central-1',
	'eu-central-2',
	'eu-west-1',
	'eu-west-2',
	'eu-south-1',
	'ap-northeast-1',
	'ap-northeast-2',
	'ap-southeast-1',
	'ap-southeast-2'
];

/** The last saved configuration, as shown in the summary strip. Empty values stay empty and render as —. */
export interface IFileStorageSummary {
	provider: FileStorageProviderEnum;
	bucket: string;
	region: string;
	endpoint: string;
	credentials: 'saved' | 'incomplete' | 'none' | 'not_needed';
}

/** Result of the client-side configuration check: field labels that are empty or hold an invalid URL. */
export interface IFileStorageCheck {
	missing: string[];
	invalidUrls: string[];
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-file-storage',
	templateUrl: './file-storage.component.html',
	styleUrls: ['./file-storage.component.scss'],
	providers: [FileStorageService, TenantService],
	standalone: false
})
export class FileStorageComponent extends TranslationBaseComponent implements OnInit {
	secureOptions = [
		{ label: SMTPSecureEnum.TRUE, value: 'true' },
		{ label: SMTPSecureEnum.FALSE, value: 'false' }
	];
	readonly wasabiRegions = WASABI_REGIONS;
	PermissionsEnum = PermissionsEnum;
	FileStorageProviderEnum = FileStorageProviderEnum;
	user: IUser;
	settings: ITenantSetting = new Object();
	loading: boolean = false;
	/** What the tenant is saved with right now — not what is being edited in the form. */
	summary: IFileStorageSummary | null = null;
	/** Result of the last "Check configuration"; cleared whenever the form changes. */
	check: IFileStorageCheck | null = null;
	/** Secret inputs the user has chosen to reveal, by control name. */
	revealed: Record<string, boolean> = {};

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

	/*
	 * Documentation link for the selected provider (none for LOCAL)
	 */
	get providerDocsUrl(): string | null {
		return PROVIDER_FIELDS[this.fileStorageProvider as FileStorageProviderEnum]?.docsUrl ?? null;
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

		// A check result describes the values it was run on; any edit makes it stale.
		this.form.valueChanges
			.pipe(
				tap(() => (this.check = null)),
				untilDestroyed(this)
			)
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
			this.summary = this.buildSummary(fileStorageProvider || defaultFileStorageProvider, settings);
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

	/**
	 * The Wasabi endpoint that matches the entered region, or null when the region is not a
	 * known Wasabi region or the service URL already matches it.
	 */
	get wasabiSuggestedEndpoint(): string | null {
		const group = this.form.get(FileStorageProviderEnum.WASABI);
		const region = `${group.get('wasabi_aws_default_region').value ?? ''}`.trim().toLowerCase();
		if (!WASABI_REGIONS.includes(region)) {
			return null;
		}

		const endpoint = region === 'us-east-1' ? 'https://s3.wasabisys.com' : `https://s3.${region}.wasabisys.com`;
		const current = `${group.get('wasabi_aws_service_url').value ?? ''}`.trim().replace(/\/+$/, '');
		return current === endpoint ? null : endpoint;
	}

	/**
	 * Put the suggested Wasabi endpoint in the service URL field
	 */
	useWasabiSuggestedEndpoint(): void {
		const endpoint = this.wasabiSuggestedEndpoint;
		if (endpoint) {
			this.form.get(FileStorageProviderEnum.WASABI).get('wasabi_aws_service_url').setValue(endpoint);
		}
	}

	/**
	 * Show or hide the value of a secret input
	 *
	 * @param control - The form control name of the secret input.
	 */
	toggleSecret(control: string): void {
		this.revealed[control] = !this.revealed[control];
	}

	/**
	 * Check the selected provider's configuration in the browser: every required field is filled
	 * and every URL field holds an http(s) URL. Nothing is sent to the server — Wasabi credentials
	 * are still verified by the API when the settings are saved.
	 */
	checkConfiguration(): void {
		const fields = PROVIDER_FIELDS[this.fileStorageProvider as FileStorageProviderEnum];
		if (!fields) {
			this.check = { missing: [], invalidUrls: [] };
			return;
		}

		const values = this.form.get(this.fileStorageProvider).getRawValue();
		const isBlank = (value: unknown) => value === null || value === undefined || `${value}`.trim() === '';

		const missing = fields.required.filter(({ control }) => isBlank(values[control])).map(({ label }) => label);

		const invalidUrls = fields.urls
			.filter(({ control }) => !isBlank(values[control]) && !this.isHttpUrl(`${values[control]}`.trim()))
			.map(({ label }) => label);

		this.check = { missing, invalidUrls };
	}

	/**
	 * Summarize the saved settings for the status strip.
	 *
	 * @param provider - The saved (or default) file storage provider.
	 * @param settings - The tenant settings as returned by the API (secrets arrive masked).
	 */
	private buildSummary(provider: FileStorageProviderEnum, settings: ITenantSetting): IFileStorageSummary {
		const fields = PROVIDER_FIELDS[provider];
		const values = (settings ?? {}) as Record<string, any>;
		const read = (name?: string): string => (name && isNotEmpty(values[name]) ? `${values[name]}` : '');

		let credentials: IFileStorageSummary['credentials'] = 'not_needed';
		if (fields) {
			const saved = fields.credentials.filter((name) => isNotEmpty(values[name])).length;
			credentials = saved === fields.credentials.length ? 'saved' : saved > 0 ? 'incomplete' : 'none';
		}

		return {
			provider,
			bucket: read(fields?.bucket),
			region: read(fields?.region),
			endpoint: read(fields?.endpoint),
			credentials
		};
	}

	private isHttpUrl(value: string): boolean {
		try {
			const { protocol } = new URL(value);
			return protocol === 'http:' || protocol === 'https:';
		} catch {
			return false;
		}
	}
}
