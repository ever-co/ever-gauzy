import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
	IMakeComIntegrationSettings,
	IMakeComOrganization,
	IMakeComTeam,
	MakeComZone,
	MAKE_COM_ZONES
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { MakeComStoreService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-settings',
	templateUrl: './make-com-settings.component.html',
	styleUrls: ['./make-com-settings.component.scss'],
	standalone: false
})
export class MakeComSettingsComponent extends TranslationBaseComponent implements OnInit {
	// Webhook settings form
	public form: FormGroup;
	public loading = false;
	public settings: IMakeComIntegrationSettings = null;

	// Zone & context
	public zones = MAKE_COM_ZONES;
	public selectedZone: MakeComZone | null = null;
	public zoneLoading = false;

	// Make.com organizations
	public makeOrganizations: IMakeComOrganization[] = [];
	public selectedMakeOrg: IMakeComOrganization | null = null;
	public orgsLoading = false;

	// Make.com teams
	public makeTeams: IMakeComTeam[] = [];
	public selectedMakeTeam: IMakeComTeam | null = null;
	public teamsLoading = false;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _makeComStoreService: MakeComStoreService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadSettings();
		this._loadSetupStatus();
	}

	// ─── Webhook Settings ───────────────────────────────────────────────────

	private _initializeForm() {
		this.form = this._fb.group({
			isEnabled: [false],
			webhookUrl: ['', [Validators.required, Validators.pattern('https?://.+')]]
		});
	}

	private _loadSettings() {
		this.loading = true;
		this._makeComStoreService
			.loadIntegrationSettings()
			.pipe(
				tap((settings: IMakeComIntegrationSettings) => {
					this.settings = settings;
					this.form.patchValue({
						isEnabled: settings.isEnabled,
						webhookUrl: settings.webhookUrl
					});
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.LOAD_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Make.com settings:', error);
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	saveSettings() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;
		this._makeComStoreService
			.updateIntegrationSettings(this.form.value)
			.pipe(
				tap((settings: IMakeComIntegrationSettings) => {
					this.settings = settings;
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.SUCCESS.SETTINGS_SAVED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.SAVE_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error saving Make.com settings:', error);
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ─── Setup Status & Zone Configuration ──────────────────────────────────

	/**
	 * Load setup status to restore previously saved zone, org, and team.
	 */
	private _loadSetupStatus() {
		this.zoneLoading = true;
		this._makeComStoreService
			.loadSetupStatus()
			.pipe(
				tap((status) => {
					this.selectedZone = status.zone as MakeComZone;

					if (status.zone) {
						// Load orgs so the user can see the list and we can restore the selection
						this._loadMakeOrganizations(status.makeOrganizationId, status.makeTeamId);
					}
				}),
				catchError(() => EMPTY),
				finalize(() => (this.zoneLoading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onZoneChange(zone: MakeComZone) {
		this.zoneLoading = true;
		this._makeComStoreService
			.setZone(zone)
			.pipe(
				tap(() => {
					this.selectedZone = zone;
					this._toastrService.success(
						`Zone set to ${zone.toUpperCase()}`,
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					// Reset org & team when zone changes
					this.selectedMakeOrg = null;
					this.selectedMakeTeam = null;
					this.makeTeams = [];
					this._loadMakeOrganizations();
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to set zone',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.zoneLoading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ─── Make.com Organizations ─────────────────────────────────────────────

	private _loadMakeOrganizations(savedOrgId?: number, savedTeamId?: number) {
		this.orgsLoading = true;
		this._makeComStoreService
			.loadMakeOrganizations()
			.pipe(
				tap((orgs) => {
					this.makeOrganizations = orgs;
					// Restore previously saved organization selection
					if (savedOrgId) {
						const savedOrg = orgs.find((o) => o.id === savedOrgId);
						if (savedOrg) {
							this.selectedMakeOrg = savedOrg;
							this._loadMakeTeams(savedOrgId, savedTeamId);
						}
					}
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to load organizations',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.orgsLoading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onMakeOrgSelect(org: IMakeComOrganization) {
		this.orgsLoading = true;
		this._makeComStoreService
			.selectMakeOrganization(org)
			.pipe(
				tap(() => {
					this.selectedMakeOrg = org;
					this.selectedMakeTeam = null;
					this._toastrService.success(
						`Organization "${org.name}" selected`,
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._loadMakeTeams(org.id);
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to select organization',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.orgsLoading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ─── Make.com Teams ─────────────────────────────────────────────────────

	private _loadMakeTeams(makeOrgId: number, savedTeamId?: number) {
		this.teamsLoading = true;
		this._makeComStoreService
			.loadMakeTeams(makeOrgId)
			.pipe(
				tap((teams) => {
					this.makeTeams = teams;
					// Restore previously saved team selection
					if (savedTeamId) {
						const savedTeam = teams.find((t) => t.id === savedTeamId);
						if (savedTeam) {
							this.selectedMakeTeam = savedTeam;
						}
					}
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to load teams',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.teamsLoading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onMakeTeamSelect(team: IMakeComTeam) {
		this.teamsLoading = true;
		this._makeComStoreService
			.selectMakeTeam(team)
			.pipe(
				tap(() => {
					this.selectedMakeTeam = team;
					this._toastrService.success(
						`Team "${team.name}" selected`,
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to select team',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.teamsLoading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ─── Computed Flags ─────────────────────────────────────────────────────

	get isSetupComplete(): boolean {
		return !!this.selectedZone && !!this.selectedMakeOrg && !!this.selectedMakeTeam;
	}
}
