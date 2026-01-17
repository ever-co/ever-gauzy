import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { NbAccordionComponent, NbAccordionItemComponent, NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, TenantService, ToastrService } from '@gauzy/ui-core/core';

/**
 * Setting names for monitoring services stored in tenant_setting table
 */
const POSTHOG_SETTINGS = {
	ENABLED: 'posthogEnabled',
	KEY: 'posthogKey',
	HOST: 'posthogHost',
	FLUSH_INTERVAL: 'posthogFlushInterval'
};

const SENTRY_SETTINGS = {
	ENABLED: 'sentryEnabled',
	DSN: 'sentryDsn'
};

const JITSU_SETTINGS = {
	ENABLED: 'jitsuEnabled',
	HOST: 'jitsuHost',
	WRITE_KEY: 'jitsuWriteKey'
};

/**
 * Scope enumeration for settings
 */
export enum SettingsScope {
	GLOBAL = 'global',
	TENANT = 'tenant'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-monitoring',
	templateUrl: './monitoring.component.html',
	styleUrls: ['./monitoring.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonitoringComponent extends TranslationBaseComponent implements OnInit {
	// Inject services using Angular 19 inject pattern
	private readonly _fb = inject(UntypedFormBuilder);
	private readonly _store = inject(Store);
	private readonly _tenantService = inject(TenantService);
	private readonly _toastrService = inject(ToastrService);

	loading = signal(false);
	user: IUser;
	PermissionsEnum = PermissionsEnum;
	SettingsScope = SettingsScope;

	/**
	 * Nebular Accordion Item Components
	 */
	@ViewChild('posthog') protected readonly posthog: NbAccordionItemComponent;
	@ViewChild('sentry') protected readonly sentry: NbAccordionItemComponent;
	@ViewChild('jitsu') protected readonly jitsu: NbAccordionItemComponent;

	/**
	 * Nebular Accordion Main Component
	 */
	@ViewChild('accordion') protected readonly accordion: NbAccordionComponent;

	/**
	 * Forms for Global scope
	 */
	protected globalPosthogForm: UntypedFormGroup = MonitoringComponent.buildPosthogForm(this._fb);
	protected globalSentryForm: UntypedFormGroup = MonitoringComponent.buildSentryForm(this._fb);
	protected globalJitsuForm: UntypedFormGroup = MonitoringComponent.buildJitsuForm(this._fb);

	/**
	 * Forms for Tenant scope
	 */
	protected tenantPosthogForm: UntypedFormGroup = MonitoringComponent.buildPosthogForm(this._fb);
	protected tenantSentryForm: UntypedFormGroup = MonitoringComponent.buildSentryForm(this._fb);
	protected tenantJitsuForm: UntypedFormGroup = MonitoringComponent.buildJitsuForm(this._fb);

	static buildPosthogForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			posthogEnabled: [false],
			posthogKey: [''],
			posthogHost: ['https://app.posthog.com'],
			posthogFlushInterval: [10000]
		});
	}

	static buildSentryForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			sentryEnabled: [false],
			sentryDsn: ['']
		});
	}

	static buildJitsuForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			jitsuEnabled: [false],
			jitsuHost: [''],
			jitsuWriteKey: ['']
		});
	}

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this._store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this._loadAllSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handle PostHog tab change
	 */
	onPosthogTabChange(tab: NbTabComponent): void {
		// Tab change is handled by nb-tabset, data is already loaded
	}

	/**
	 * Handle Sentry tab change
	 */
	onSentryTabChange(tab: NbTabComponent): void {
		// Tab change is handled by nb-tabset, data is already loaded
	}

	/**
	 * Handle Jitsu tab change
	 */
	onJitsuTabChange(tab: NbTabComponent): void {
		// Tab change is handled by nb-tabset, data is already loaded
	}

	/**
	 * Load all settings for both services and both scopes
	 */
	private async _loadAllSettings(): Promise<void> {
		this.loading.set(true);
		try {
			// Fetch both global and tenant settings once
			const [globalSettings, tenantSettings] = await Promise.all([
				this._tenantService.getGlobalSettings(),
				this._tenantService.getSettings()
			]);

			// Patch all forms with fetched data
			this._patchGlobalForms(globalSettings);
			this._patchTenantForms(tenantSettings);
		} catch (error) {
			console.error('Error loading settings:', error);
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Patch global forms with settings
	 */
	private _patchGlobalForms(settings: Record<string, any>): void {
		if (!settings) return;

		// PostHog
		this.globalPosthogForm.patchValue({
			posthogEnabled: settings[POSTHOG_SETTINGS.ENABLED] === 'true',
			posthogKey: settings[POSTHOG_SETTINGS.KEY] ?? '',
			posthogHost: settings[POSTHOG_SETTINGS.HOST] ?? 'https://app.posthog.com',
			posthogFlushInterval: parseInt(settings[POSTHOG_SETTINGS.FLUSH_INTERVAL], 10) || 10000
		});

		// Sentry
		this.globalSentryForm.patchValue({
			sentryEnabled: settings[SENTRY_SETTINGS.ENABLED] === 'true',
			sentryDsn: settings[SENTRY_SETTINGS.DSN] ?? ''
		});

		// Jitsu
		this.globalJitsuForm.patchValue({
			jitsuEnabled: settings[JITSU_SETTINGS.ENABLED] === 'true',
			jitsuHost: settings[JITSU_SETTINGS.HOST] ?? '',
			jitsuWriteKey: settings[JITSU_SETTINGS.WRITE_KEY] ?? ''
		});
	}

	/**
	 * Patch tenant forms with settings
	 */
	private _patchTenantForms(settings: Record<string, any>): void {
		if (!settings) return;

		// PostHog
		this.tenantPosthogForm.patchValue({
			posthogEnabled: settings[POSTHOG_SETTINGS.ENABLED] === 'true',
			posthogKey: settings[POSTHOG_SETTINGS.KEY] ?? '',
			posthogHost: settings[POSTHOG_SETTINGS.HOST] ?? 'https://app.posthog.com',
			posthogFlushInterval: parseInt(settings[POSTHOG_SETTINGS.FLUSH_INTERVAL], 10) || 10000
		});

		// Sentry
		this.tenantSentryForm.patchValue({
			sentryEnabled: settings[SENTRY_SETTINGS.ENABLED] === 'true',
			sentryDsn: settings[SENTRY_SETTINGS.DSN] ?? ''
		});

		// Jitsu
		this.tenantJitsuForm.patchValue({
			jitsuEnabled: settings[JITSU_SETTINGS.ENABLED] === 'true',
			jitsuHost: settings[JITSU_SETTINGS.HOST] ?? '',
			jitsuWriteKey: settings[JITSU_SETTINGS.WRITE_KEY] ?? ''
		});
	}

	/**
	 * Save Global PostHog settings
	 */
	async saveGlobalPosthog(): Promise<void> {
		if (this.globalPosthogForm.invalid) return;

		try {
			this.loading.set(true);
			const formValue = this.globalPosthogForm.getRawValue();
			const settings = {
				[POSTHOG_SETTINGS.ENABLED]: String(formValue.posthogEnabled),
				[POSTHOG_SETTINGS.KEY]: formValue.posthogKey,
				[POSTHOG_SETTINGS.HOST]: formValue.posthogHost,
				[POSTHOG_SETTINGS.FLUSH_INTERVAL]: String(formValue.posthogFlushInterval)
			};
			await this._tenantService.saveGlobalSettings(settings);
			this._toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			console.error('Error saving Global PostHog settings:', error);
			this._toastrService.danger('TOASTR.MESSAGE.SETTINGS_UPDATE_ERROR');
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Save Tenant PostHog settings
	 */
	async saveTenantPosthog(): Promise<void> {
		if (this.tenantPosthogForm.invalid) return;

		try {
			this.loading.set(true);
			const formValue = this.tenantPosthogForm.getRawValue();
			const settings = {
				[POSTHOG_SETTINGS.ENABLED]: String(formValue.posthogEnabled),
				[POSTHOG_SETTINGS.KEY]: formValue.posthogKey,
				[POSTHOG_SETTINGS.HOST]: formValue.posthogHost,
				[POSTHOG_SETTINGS.FLUSH_INTERVAL]: String(formValue.posthogFlushInterval)
			};
			await this._tenantService.saveDynamicSettings(settings);
			this._toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			console.error('Error saving Tenant PostHog settings:', error);
			this._toastrService.danger('TOASTR.MESSAGE.SETTINGS_UPDATE_ERROR');
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Save Global Sentry settings
	 */
	async saveGlobalSentry(): Promise<void> {
		if (this.globalSentryForm.invalid) return;

		try {
			this.loading.set(true);
			const formValue = this.globalSentryForm.getRawValue();
			const settings = {
				[SENTRY_SETTINGS.ENABLED]: String(formValue.sentryEnabled),
				[SENTRY_SETTINGS.DSN]: formValue.sentryDsn
			};
			await this._tenantService.saveGlobalSettings(settings);
			this._toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			console.error('Error saving Global Sentry settings:', error);
			this._toastrService.danger('TOASTR.MESSAGE.SETTINGS_UPDATE_ERROR');
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Save Tenant Sentry settings
	 */
	async saveTenantSentry(): Promise<void> {
		if (this.tenantSentryForm.invalid) return;

		try {
			this.loading.set(true);
			const formValue = this.tenantSentryForm.getRawValue();
			const settings = {
				[SENTRY_SETTINGS.ENABLED]: String(formValue.sentryEnabled),
				[SENTRY_SETTINGS.DSN]: formValue.sentryDsn
			};
			await this._tenantService.saveDynamicSettings(settings);
			this._toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			console.error('Error saving Tenant Sentry settings:', error);
			this._toastrService.danger('TOASTR.MESSAGE.SETTINGS_UPDATE_ERROR');
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Save Global Jitsu settings
	 */
	async saveGlobalJitsu(): Promise<void> {
		if (this.globalJitsuForm.invalid) return;

		try {
			this.loading.set(true);
			const formValue = this.globalJitsuForm.getRawValue();
			const settings = {
				[JITSU_SETTINGS.ENABLED]: String(formValue.jitsuEnabled),
				[JITSU_SETTINGS.HOST]: formValue.jitsuHost,
				[JITSU_SETTINGS.WRITE_KEY]: formValue.jitsuWriteKey
			};
			await this._tenantService.saveGlobalSettings(settings);
			this._toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			console.error('Error saving Global Jitsu settings:', error);
			this._toastrService.danger('TOASTR.MESSAGE.SETTINGS_UPDATE_ERROR');
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Save Tenant Jitsu settings
	 */
	async saveTenantJitsu(): Promise<void> {
		if (this.tenantJitsuForm.invalid) return;

		try {
			this.loading.set(true);
			const formValue = this.tenantJitsuForm.getRawValue();
			const settings = {
				[JITSU_SETTINGS.ENABLED]: String(formValue.jitsuEnabled),
				[JITSU_SETTINGS.HOST]: formValue.jitsuHost,
				[JITSU_SETTINGS.WRITE_KEY]: formValue.jitsuWriteKey
			};
			await this._tenantService.saveDynamicSettings(settings);
			this._toastrService.success('TOASTR.MESSAGE.SETTINGS_SAVED');
		} catch (error) {
			console.error('Error saving Tenant Jitsu settings:', error);
			this._toastrService.danger('TOASTR.MESSAGE.SETTINGS_UPDATE_ERROR');
		} finally {
			this.loading.set(false);
		}
	}
}
