import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { PermissionsEnum, PreferredUiEnum } from '@gauzy/contracts';
import { Store, TenantUiPreferencesService, ToastrService } from '@gauzy/ui-core/core';

/**
 * Settings → General.
 *
 * Tenant-wide preferences that are neither organization- nor user-scoped. Today that is the
 * "Preferred UI" switch (Angular vs React) that decides which flavour of a page shipping in
 * both flavours every user of the tenant gets — starting with the Time Tracking dashboard.
 */
@Component({
	selector: 'ga-general-settings',
	templateUrl: './general-setting.component.html',
	styleUrls: ['./general-setting.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class GeneralSettingComponent implements OnInit {
	private readonly uiPreferences = inject(TenantUiPreferencesService);
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);

	public readonly PreferredUiEnum = PreferredUiEnum;
	public readonly preferredUi = this.uiPreferences.preferredUi;
	public readonly loading = signal(true);
	public readonly saving = signal(false);
	/** Only tenant administrators may change the preference; everyone else sees it read-only. */
	public readonly canEdit = computed(() => this.store.hasPermission(PermissionsEnum.TENANT_SETTING));

	async ngOnInit(): Promise<void> {
		try {
			// Always re-read: another administrator may have switched the tenant meanwhile.
			await this.uiPreferences.reload();
		} finally {
			this.loading.set(false);
		}
	}

	async onPreferredUiChange(value: PreferredUiEnum): Promise<void> {
		if (!value || value === this.preferredUi() || !this.canEdit()) {
			return;
		}
		this.saving.set(true);
		try {
			await this.uiPreferences.update({ preferredUi: value });
			this.toastr.success('SETTINGS_GENERAL.PREFERRED_UI.SAVED');
		} catch (error) {
			this.toastr.danger(error?.error?.message ?? 'SETTINGS_GENERAL.PREFERRED_UI.SAVE_ERROR');
		} finally {
			this.saving.set(false);
		}
	}
}
