import { Component, OnInit, ViewChild } from '@angular/core';
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
	standalone: false
})
export class MonitoringComponent extends TranslationBaseComponent implements OnInit {
	loading: boolean = false;
	user: IUser;
	PermissionsEnum = PermissionsEnum;
	SettingsScope = SettingsScope;

	/**
	 * Nebular Accordion Item Components
	 */
	@ViewChild('posthog') posthog: NbAccordionItemComponent;
	@ViewChild('sentry') sentry: NbAccordionItemComponent;
	@ViewChild('jitsu') jitsu: NbAccordionItemComponent;

	/**
	 * Nebular Accordion Main Component
	 */
	@ViewChild('accordion') accordion: NbAccordionComponent;

	/**
	 * Forms for Global scope
	 */
	globalPosthogForm: UntypedFormGroup = MonitoringComponent.buildPosthogForm(this._fb);
	globalSentryForm: UntypedFormGroup = MonitoringComponent.buildSentryForm(this._fb);
	globalJitsuForm: UntypedFormGroup = MonitoringComponent.buildJitsuForm(this._fb);

	/**
	 * Forms for Tenant scope
	 */
	tenantPosthogForm: UntypedFormGroup = MonitoringComponent.buildPosthogForm(this._fb);
	tenantSentryForm: UntypedFormGroup = MonitoringComponent.buildSentryForm(this._fb);
	tenantJitsuForm: UntypedFormGroup = MonitoringComponent.buildJitsuForm(this._fb);

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

	constructor(
		public readonly translateService: TranslateService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _tenantService: TenantService,
		private readonly _toastrService: ToastrService
	) {
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
		this.loading = true;
		try {
			await Promise.all([
				this._loadGlobalPosthogSettings(),
				this._loadTenantPosthogSettings(),
				this._loadGlobalSentrySettings(),
				this._loadTenantSentrySettings(),
				this._loadGlobalJitsuSettings(),
				this._loadTenantJitsuSettings()
			]);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load Global PostHog settings
	 */
	private async _loadGlobalPosthogSettings(): Promise<void> {
		try {
			const settings = await this._tenantService.getGlobalSettings();
			if (settings) {
				this.globalPosthogForm.patchValue({
					posthogEnabled: settings[POSTHOG_SETTINGS.ENABLED] === 'true',
					posthogKey: settings[POSTHOG_SETTINGS.KEY] ?? '',
					posthogHost: settings[POSTHOG_SETTINGS.HOST] ?? 'https://app.posthog.com',
					posthogFlushInterval: parseInt(settings[POSTHOG_SETTINGS.FLUSH_INTERVAL], 10) || 10000
				});
			}
		} catch (error) {
			console.error('Error loading Global PostHog settings:', error);
		}
	}

	/**
	 * Load Tenant PostHog settings
	 */
	private async _loadTenantPosthogSettings(): Promise<void> {
		try {
			const settings = await this._tenantService.getSettings();
			if (settings) {
				this.tenantPosthogForm.patchValue({
					posthogEnabled: settings[POSTHOG_SETTINGS.ENABLED] === 'true',
					posthogKey: settings[POSTHOG_SETTINGS.KEY] ?? '',
					posthogHost: settings[POSTHOG_SETTINGS.HOST] ?? 'https://app.posthog.com',
					posthogFlushInterval: parseInt(settings[POSTHOG_SETTINGS.FLUSH_INTERVAL], 10) || 10000
				});
			}
		} catch (error) {
			console.error('Error loading Tenant PostHog settings:', error);
		}
	}

	/**
	 * Load Global Sentry settings
	 */
	private async _loadGlobalSentrySettings(): Promise<void> {
		try {
			const settings = await this._tenantService.getGlobalSettings();
			if (settings) {
				this.globalSentryForm.patchValue({
					sentryEnabled: settings[SENTRY_SETTINGS.ENABLED] === 'true',
					sentryDsn: settings[SENTRY_SETTINGS.DSN] ?? ''
				});
			}
		} catch (error) {
			console.error('Error loading Global Sentry settings:', error);
		}
	}

	/**
	 * Load Tenant Sentry settings
	 */
	private async _loadTenantSentrySettings(): Promise<void> {
		try {
			const settings = await this._tenantService.getSettings();
			if (settings) {
				this.tenantSentryForm.patchValue({
					sentryEnabled: settings[SENTRY_SETTINGS.ENABLED] === 'true',
					sentryDsn: settings[SENTRY_SETTINGS.DSN] ?? ''
				});
			}
		} catch (error) {
			console.error('Error loading Tenant Sentry settings:', error);
		}
	}

	/**
	 * Load Global Jitsu settings
	 */
	private async _loadGlobalJitsuSettings(): Promise<void> {
		try {
			const settings = await this._tenantService.getGlobalSettings();
			if (settings) {
				this.globalJitsuForm.patchValue({
					jitsuEnabled: settings[JITSU_SETTINGS.ENABLED] === 'true',
					jitsuHost: settings[JITSU_SETTINGS.HOST] ?? '',
					jitsuWriteKey: settings[JITSU_SETTINGS.WRITE_KEY] ?? ''
				});
			}
		} catch (error) {
			console.error('Error loading Global Jitsu settings:', error);
		}
	}

	/**
	 * Load Tenant Jitsu settings
	 */
	private async _loadTenantJitsuSettings(): Promise<void> {
		try {
			const settings = await this._tenantService.getSettings();
			if (settings) {
				this.tenantJitsuForm.patchValue({
					jitsuEnabled: settings[JITSU_SETTINGS.ENABLED] === 'true',
					jitsuHost: settings[JITSU_SETTINGS.HOST] ?? '',
					jitsuWriteKey: settings[JITSU_SETTINGS.WRITE_KEY] ?? ''
				});
			}
		} catch (error) {
			console.error('Error loading Tenant Jitsu settings:', error);
		}
	}

	/**
	 * Save Global PostHog settings
	 */
	async saveGlobalPosthog(): Promise<void> {
		if (this.globalPosthogForm.invalid) return;

		try {
			this.loading = true;
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
			this.loading = false;
		}
	}

	/**
	 * Save Tenant PostHog settings
	 */
	async saveTenantPosthog(): Promise<void> {
		if (this.tenantPosthogForm.invalid) return;

		try {
			this.loading = true;
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
			this.loading = false;
		}
	}

	/**
	 * Save Global Sentry settings
	 */
	async saveGlobalSentry(): Promise<void> {
		if (this.globalSentryForm.invalid) return;

		try {
			this.loading = true;
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
			this.loading = false;
		}
	}

	/**
	 * Save Tenant Sentry settings
	 */
	async saveTenantSentry(): Promise<void> {
		if (this.tenantSentryForm.invalid) return;

		try {
			this.loading = true;
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
			this.loading = false;
		}
	}

	/**
	 * Save Global Jitsu settings
	 */
	async saveGlobalJitsu(): Promise<void> {
		if (this.globalJitsuForm.invalid) return;

		try {
			this.loading = true;
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
			this.loading = false;
		}
	}

	/**
	 * Save Tenant Jitsu settings
	 */
	async saveTenantJitsu(): Promise<void> {
		if (this.tenantJitsuForm.invalid) return;

		try {
			this.loading = true;
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
			this.loading = false;
		}
	}
}
