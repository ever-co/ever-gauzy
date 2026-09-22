import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
	/** The role permissions as a signal, so `canEdit` re-evaluates once they (re)load. */
	private readonly rolePermissions = toSignal(this.store.userRolePermissions$, { initialValue: null });
	/** Only tenant administrators may change the preference; everyone else sees it read-only. */
	public readonly canEdit = computed(() => {
		// Read the permissions signal so a hard reload straight onto this page — where the
		// permissions arrive AFTER the first render — flips the switch to editable.
		this.rolePermissions();
		return this.store.hasPermission(PermissionsEnum.TENANT_SETTING);
	});

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
