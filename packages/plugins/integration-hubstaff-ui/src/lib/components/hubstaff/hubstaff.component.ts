import { Component, OnInit, OnDestroy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, firstValueFrom, filter, catchError, finalize, switchMap, tap } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IHubstaffOrganization, IHubstaffProject, IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, HubstaffService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-hubstaff',
    templateUrl: './hubstaff.component.html',
    styleUrls: ['./hubstaff.component.scss'],
    providers: [TitleCasePipe],
    standalone: false
})
export class HubstaffComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public settingsSmartTable: any;
	public organizations$: Observable<IHubstaffOrganization[]>;
	public organizations: IHubstaffOrganization[] = [];
	public projects$: Observable<IHubstaffProject[]>;
	public projects: IHubstaffProject[] = [];
	public organization: IOrganization;
	public selectedProjects: IHubstaffProject[] = [];
	public loading: boolean;
	public integrationId: ID;

	constructor(
		private readonly _router: Router,
		public readonly _translateService: TranslateService,
		private readonly _hubstaffService: HubstaffService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _toastrService: ToastrService,
		private readonly _dialogService: NbDialogService,
		private readonly _store: Store,
		private readonly _titlecasePipe: TitleCasePipe
	) {
		super(_translateService);
	}

	ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this._setTokenAndLoadOrganizations();

		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	/**
	 * Fetches and sets the Hubstaff integration data from the ActivatedRoute data.
	 */
	private _setTokenAndLoadOrganizations() {
		this.integrationId = this._activatedRoute.snapshot.params.id;
		this._hubstaffService.getIntegration(this.integrationId).pipe(untilDestroyed(this)).subscribe();

		// Fetch organizations for the given integration
		this.organizations$ = this._hubstaffService.getToken(this.integrationId).pipe(
			tap(() => (this.loading = true)),
			switchMap(() => this._hubstaffService.getOrganizations(this.integrationId)),
			tap((organizations) => (this.organizations = organizations)),
			catchError((error) => {
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			finalize(() => (this.loading = false))
		);
	}

	/**
	 * Load Smart Table settings to configure the component.
	 */
	private _loadSettingsSmartTable() {
		this.settingsSmartTable = {
			selectedRowIndex: -1,
			selectMode: 'multi',
			actions: {
				add: false,
				edit: false,
				delete: false,
				select: true
			},
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.NAME'),
					type: 'string',
					isFilterable: false
				},
				description: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'),
					type: 'string',
					isFilterable: false
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
					valuePrepareFunction: (_: string) => this._titlecasePipe.transform(_)
				}
			}
		};
	}

	/**
	 *
	 * @param organization
	 */
	selectOrganization(organization) {
		this.projects$ = organization ? this._fetchProjects(organization) : of([]);
	}

	/**
	 * Fetches projects for a given organization.
	 * @param organization
	 * @returns
	 */
	private _fetchProjects(organization) {
		this.loading = true;
		//	Fetch projects for the given organization
		return this._hubstaffService.getProjects(organization.id, this.integrationId).pipe(
			// Update component state with fetched projects
			tap((projects) => (this.projects = projects)),
			// Handle errors
			catchError((error) => {
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			finalize(() => (this.loading = false))
		);
	}

	/**
	 *  Select a Hubstaff project.
	 * @param param0
	 */
	selectProject({ selected }) {
		this.selectedProjects = selected;
	}

	/**
	 * Initiates a manual synchronization process for Hubstaff projects.
	 * @returns
	 */
	syncProjects() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		this._hubstaffService
			.syncProjects(this.selectedProjects, this.integrationId, organizationId)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.HUBSTAFF_PAGE.SYNCED_PROJECTS'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of(null);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initiates a manual synchronization process for Hubstaff projects.
	 * @returns
	 */
	autoSync() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		this.loading = true;
		this._hubstaffService
			.autoSync({
				integrationId: this.integrationId,
				hubstaffOrganizations: this.organizations,
				organizationId
			})
			.pipe(
				tap((es) => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.HUBSTAFF_PAGE.SYNCED_ENTITIES'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of(null);
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens a modal popover for integration settings if the 'integration' object is defined.
	 * @returns
	 */
	async openSettingModal() {
		const dialog = this._dialogService.open(SettingsDialogComponent);
		const data = await firstValueFrom(dialog.onClose);

		if (!data) {
			this._hubstaffService.resetSettings();
			return;
		}

		// Update integration settings
		const settings$ = this._hubstaffService.updateSettings(this.integrationId);
		settings$
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.HUBSTAFF_PAGE.SETTINGS_UPDATED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of(null);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Apply translations to a Smart Table component when the language changes.
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => {
					this._loadSettingsSmartTable();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Navigate to the "Integrations" page.
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	/**
	 * Navigates to the 'Reset Integration' route within the Hubstaff integration setup wizard.
	 */
	navigateToResetIntegration(): void {
		this._router.navigate(['/pages/integrations/hubstaff/regenerate']);
	}
}
