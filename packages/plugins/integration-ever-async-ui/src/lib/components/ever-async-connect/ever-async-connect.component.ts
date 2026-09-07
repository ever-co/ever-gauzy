import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { catchError, distinctUntilChanged, forkJoin, of, switchMap, tap, throwError } from 'rxjs';
import { ID, IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { ErrorHandlingService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	EverAsyncService,
	IEverAsyncOptions,
	IEverAsyncSettingsResponse,
	IEverAsyncSetupResponse,
	IEverAsyncUserMapping
} from '../../services/ever-async.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-ever-async-connect',
	templateUrl: './ever-async-connect.component.html',
	styleUrls: ['./ever-async-connect.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EverAsyncConnectComponent extends TranslationBaseComponent implements OnInit {
	private readonly store = inject(Store);
	private readonly service = inject(EverAsyncService);
	private readonly location = inject(Location);
	private readonly errors = inject(ErrorHandlingService);
	private readonly toastr = inject(ToastrService);
	readonly organization = signal<IOrganization | null>(null);
	readonly loading = signal(false);
	readonly verifying = signal(false);
	readonly connectionOk = signal<boolean | null>(null);
	readonly settings = signal<IEverAsyncSettingsResponse | null>(null);
	readonly credentials = signal<IEverAsyncSetupResponse | null>(null);
	readonly options = signal<IEverAsyncOptions>({ employees: [], projects: [] });
	readonly showSecret = signal(false);
	readonly ready = signal(false);
	readonly form = new FormGroup({
		serverUrl: new FormControl('https://api-async.ever.co', {
			nonNullable: true,
			validators: [Validators.required, Validators.pattern(/^https:\/\/[^\s]+$/)]
		}),
		projectIds: new FormControl<ID[]>([], { nonNullable: true }),
		isEnabled: new FormControl(true, { nonNullable: true }),
		userMappings: new FormArray<
			FormGroup<{
				channel: FormControl<'slack' | 'discord'>;
				workspace: FormControl<string>;
				chatUserId: FormControl<string>;
				employeeId: FormControl<string>;
			}>
		>([])
	});

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}
	get canSave() {
		return this.store.hasPermission(
			this.settings() ? PermissionsEnum.INTEGRATION_EDIT : PermissionsEnum.INTEGRATION_ADD
		);
	}
	get canRotate() {
		return this.store.hasPermission(PermissionsEnum.INTEGRATION_EDIT);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChanged((a, b) => a?.id === b?.id),
				tap((org) => {
					this.organization.set(org ?? null);
					this.settings.set(null);
					this.credentials.set(null);
					this.options.set({ employees: [], projects: [] });
					this.ready.set(false);
					this.loading.set(false);
					this.connectionOk.set(null);
					this.showSecret.set(false);
					this.form.reset({ serverUrl: 'https://api-async.ever.co', projectIds: [], isEnabled: true });
					this.form.controls.userMappings.clear();
				}),
				switchMap((org) =>
					org?.id
						? forkJoin({
								options: this.service.getOptions(org.id),
								settings: this.service
									.getSettings(org.id)
									.pipe(
										catchError((error: HttpErrorResponse) =>
											error.status === 404 ? of(null) : throwError(() => error)
										)
									)
							}).pipe(
								catchError((error) => {
									this.errors.handleError(error);
									return of(null);
								})
							)
						: of(null)
				),
				untilDestroyed(this)
			)
			.subscribe((result) => {
				if (!result) return;
				this.options.set(result.options);
				this.settings.set(result.settings);
				this.ready.set(true);
				if (result.settings) {
					this.form.patchValue(result.settings);
					for (const mapping of result.settings.userMappings) this.addMapping(mapping);
				}
			});
		this.form.controls.serverUrl.valueChanges
			.pipe(untilDestroyed(this))
			.subscribe(() => this.connectionOk.set(null));
	}

	goBack() {
		this.location.back();
	}
	addMapping(mapping?: IEverAsyncUserMapping) {
		this.form.controls.userMappings.push(
			new FormGroup({
				channel: new FormControl<'slack' | 'discord'>(mapping?.channel ?? 'slack', {
					nonNullable: true,
					validators: [Validators.required]
				}),
				workspace: new FormControl(mapping?.workspace ?? '', {
					nonNullable: true,
					validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/^\S+$/)]
				}),
				chatUserId: new FormControl(mapping?.chatUserId ?? '', {
					nonNullable: true,
					validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/^\S+$/)]
				}),
				employeeId: new FormControl(mapping?.employeeId ?? '', {
					nonNullable: true,
					validators: [Validators.required]
				})
			})
		);
	}
	removeMapping(index: number) {
		this.form.controls.userMappings.removeAt(index);
	}
	toggleProject(id: ID) {
		const ids = this.form.controls.projectIds.value;
		this.form.controls.projectIds.setValue(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
	}

	testConnection() {
		const serverUrl = this.form.controls.serverUrl.value.trim();
		if (this.verifying() || this.form.controls.serverUrl.invalid) {
			this.form.controls.serverUrl.markAsTouched();
			return;
		}
		this.verifying.set(true);
		this.connectionOk.set(null);
		this.service
			.verify(serverUrl)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result) => {
					this.verifying.set(false);
					if (this.form.controls.serverUrl.value.trim() === serverUrl) this.connectionOk.set(result.ok);
				},
				error: (error) => {
					this.verifying.set(false);
					this.connectionOk.set(false);
					this.errors.handleError(error);
				}
			});
	}

	connect() {
		const organizationId = this.organization()?.id;
		if (!organizationId || !this.ready() || this.loading() || !this.canSave) return;
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		const dto = this.form.getRawValue();
		dto.serverUrl = dto.serverUrl.trim();
		this.loading.set(true);
		if (this.settings()) {
			this.service
				.updateSettings(dto, organizationId)
				.pipe(untilDestroyed(this))
				.subscribe({
					next: () => {
						if (this.organization()?.id !== organizationId) return;
						this.loading.set(false);
						this.settings.update((value) => (value ? { ...value, ...dto } : value));
						this.saved();
					},
					error: (error) => this.failed(error, organizationId)
				});
		} else {
			this.service
				.setup(dto, organizationId)
				.pipe(untilDestroyed(this))
				.subscribe({
					next: (result) => {
						if (this.organization()?.id !== organizationId) return;
						this.loading.set(false);
						this.credentials.set(result);
						this.settings.set({
							...dto,
							integrationTenantId: result.integrationTenantId,
							tenantId: result.tenantId,
							organizationId: result.organizationId,
							hasApiKey: true
						});
						this.saved();
					},
					error: (error) => this.failed(error, organizationId)
				});
		}
	}

	rotateCredentials() {
		const organizationId = this.organization()?.id;
		if (!organizationId || !this.canRotate || this.loading()) return;
		this.loading.set(true);
		this.credentials.set(null);
		this.showSecret.set(false);
		this.service
			.rotateCredentials(organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result) => {
					if (this.organization()?.id !== organizationId) return;
					this.loading.set(false);
					this.credentials.set(result);
				},
				error: (error) => this.failed(error, organizationId)
			});
	}

	private saved() {
		this.toastr.success(this.getTranslation('INTEGRATIONS.EVER_ASYNC_PAGE.SAVED'));
	}
	private failed(error: HttpErrorResponse, organizationId: ID) {
		if (this.organization()?.id !== organizationId) return;
		this.loading.set(false);
		this.errors.handleError(error);
	}

	get gauzyApiUrl(): string {
		return new URL(API_PREFIX, window.location.origin).toString().replace(/\/api\/?$/, '');
	}

	get connectorConfig(): string {
		const settings = this.settings();
		if (!settings) return '';
		const apiUrl = this.gauzyApiUrl;
		return `[connectors.gauzy]\nbase_url = ${JSON.stringify(apiUrl)}\napp_base_url = ${JSON.stringify(window.location.origin)}\nintegration_id = ${JSON.stringify(settings.integrationTenantId)}\ntenant_id = ${JSON.stringify(settings.tenantId)}\norganization_id = ${JSON.stringify(settings.organizationId)}\napi_key_env = "GAUZY_ASYNC_API_KEY"\napi_secret_env = "GAUZY_ASYNC_API_SECRET"\nasync_tenant_id = "YOUR_ASYNC_TENANT"\nchannel = "slack"\nworkspace = "YOUR_CHAT_WORKSPACE"`;
	}
}
