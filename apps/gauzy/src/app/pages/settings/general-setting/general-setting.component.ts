import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { IImageAsset, ITenant, IWorkSpace, PermissionsEnum, PreferredUiEnum, RolesEnum } from '@gauzy/contracts';
import { Store, TenantService, TenantUiPreferencesService, ToastrService } from '@gauzy/ui-core/core';

/** The workspace switcher's fallback when a tenant has no logo (see `WorkspaceAuthService`). */
const DEFAULT_WORKSPACE_LOGO = '/assets/images/default.svg';

/** Rejects a value that is empty once trimmed — the API refuses a whitespace-only tenant name. */
function notBlank(control: AbstractControl): ValidationErrors | null {
	return typeof control.value === 'string' && control.value.length > 0 && !control.value.trim() ? { blank: true } : null;
}

/**
 * The id of the tenant's logo asset. Under MikroORM `imageId` is a non-persisted mirror that the API
 * leaves empty, so read it from the (eagerly loaded) `image` relation first; otherwise a plain save
 * would send `imageId: null` and unlink the logo.
 */
function tenantImageId(tenant: ITenant | null): string | null {
	return tenant?.image?.id ?? tenant?.imageId ?? null;
}

/**
 * Settings → General. Groups, top to bottom:
 * - the signed-in user's account and personal preferences (see {@link PersonalSettingsComponent}),
 * - the tenant profile (name, logo and id — super administrators only), and
 * - the tenant-wide "Preferred UI" switch (Angular vs React) that decides which flavour of a page shipping in
 *   both flavours every user of the tenant gets — starting with the Time Tracking dashboard.
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
	private readonly tenantService = inject(TenantService);
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);
	private readonly fb = inject(FormBuilder);
	private readonly destroyRef = inject(DestroyRef);

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

	// ── Tenant profile ──────────────────────────────────────────────────────
	private readonly user = toSignal(this.store.user$, { initialValue: this.store.user });
	/** `PUT /tenant` is restricted to the SUPER_ADMIN role, so only they see the tenant profile section. */
	public readonly canEditProfile = computed(() => this.user()?.role?.name === RolesEnum.SUPER_ADMIN);
	public readonly tenant = signal<ITenant | null>(null);
	public readonly profileLoading = signal(true);
	public readonly profileSaving = signal(false);
	public readonly profileLoadFailed = signal(false);
	/** The logo shown in the preview: the freshly uploaded image, or the saved one. */
	public readonly logoUrl = signal<string | null>(null);
	public readonly logoHover = signal(false);
	/** Briefly `true` after the tenant id was copied, to swap the copy icon for a checkmark. */
	public readonly copied = signal(false);
	private copiedTimer: ReturnType<typeof setTimeout> | null = null;

	public readonly profileForm = this.fb.group({
		name: ['', [Validators.required, notBlank, Validators.maxLength(255)]],
		imageId: [null as string | null],
		logo: [null as string | null]
	});

	constructor() {
		this.destroyRef.onDestroy(() => this.copiedTimer && clearTimeout(this.copiedTimer));
	}

	async ngOnInit(): Promise<void> {
		await Promise.all([this.loadPreferredUi(), this.loadTenant()]);
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

	/** Called by `ngx-image-uploader` once the new logo is stored as an image asset. */
	onLogoUploaded(image: IImageAsset): void {
		if (!image?.id) {
			this.onLogoUploadError();
			return;
		}
		const url = image.fullUrl ?? null;
		this.profileForm.patchValue({ imageId: image.id, logo: url });
		this.profileForm.markAsDirty();
		this.logoUrl.set(url);
	}

	onLogoUploadError(): void {
		this.toastr.danger('SETTINGS_GENERAL.TENANT_PROFILE.LOGO_UPLOAD_ERROR');
	}

	onRemoveLogo(): void {
		this.profileForm.patchValue({ imageId: null, logo: null });
		this.profileForm.markAsDirty();
		this.logoUrl.set(null);
	}

	async onCopyTenantId(tenantId: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(tenantId);
		} catch {
			this.toastr.danger('SETTINGS_GENERAL.TENANT_PROFILE.COPY_ERROR');
			return;
		}
		this.copied.set(true);
		if (this.copiedTimer) {
			clearTimeout(this.copiedTimer);
		}
		this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
	}

	/** Puts the form back to the values last loaded from the API. */
	onResetProfile(): void {
		this.applyTenant(this.tenant());
	}

	async onSaveProfile(): Promise<void> {
		if (!this.canEditProfile() || this.profileForm.invalid || this.profileSaving()) {
			this.profileForm.markAllAsTouched();
			return;
		}
		const { name, imageId, logo } = this.profileForm.getRawValue();
		const input = { name: (name ?? '').trim(), imageId, logo };
		this.profileSaving.set(true);
		try {
			try {
				await this.tenantService.update(input);
			} catch (error) {
				this.toastr.danger(error?.error?.message ?? 'SETTINGS_GENERAL.TENANT_PROFILE.SAVE_ERROR');
				return;
			}
			// The save went through. `PUT /tenant` answers with an UpdateResult, so re-read the
			// tenant; should that fail, show what was just saved instead of the stale values.
			let tenant: ITenant;
			try {
				tenant = await this.tenantService.getCurrent();
			} catch {
				const previous = this.tenant();
				tenant = {
					...previous,
					...input,
					image: imageId && imageId === tenantImageId(previous) ? previous?.image : null
				};
			}
			this.applyTenant(tenant);
			this.syncStoreTenant(tenant);
			this.toastr.success('SETTINGS_GENERAL.TENANT_PROFILE.SAVED');
		} finally {
			this.profileSaving.set(false);
		}
	}

	private async loadPreferredUi(): Promise<void> {
		try {
			// Always re-read: another administrator may have switched the tenant meanwhile.
			await this.uiPreferences.reload();
		} finally {
			this.loading.set(false);
		}
	}

	private async loadTenant(): Promise<void> {
		try {
			this.applyTenant(await this.tenantService.getCurrent());
			this.profileLoadFailed.set(false);
		} catch {
			this.profileLoadFailed.set(true);
		} finally {
			this.profileLoading.set(false);
		}
	}

	private applyTenant(tenant: ITenant | null): void {
		this.tenant.set(tenant);
		const logo = tenant?.image?.fullUrl ?? tenant?.logo ?? null;
		this.profileForm.reset({
			name: tenant?.name ?? '',
			imageId: tenantImageId(tenant),
			logo
		});
		this.logoUrl.set(logo);
	}

	/**
	 * The sidebar logo and the workspace switcher read the selected workspace, the cached
	 * workspace list and `user.tenant`; refresh all three without a reload.
	 */
	private syncStoreTenant(tenant: ITenant): void {
		const user = this.store.user;
		if (user) {
			this.store.user = {
				...user,
				tenant: { ...user.tenant, name: tenant.name, logo: tenant.logo, imageId: tenantImageId(tenant), image: tenant.image }
			};
		}
		const toWorkspace = (workspace: IWorkSpace): IWorkSpace =>
			workspace?.id === tenant.id
				? { ...workspace, name: tenant.name, imgUrl: tenant.logo || DEFAULT_WORKSPACE_LOGO }
				: workspace;
		if (this.store.workspaces.some((workspace) => workspace.id === tenant.id)) {
			this.store.workspaces = this.store.workspaces.map(toWorkspace);
		}
		if (this.store.selectedWorkspace?.id === tenant.id) {
			this.store.selectedWorkspace = toWorkspace(this.store.selectedWorkspace);
		}
	}
}
