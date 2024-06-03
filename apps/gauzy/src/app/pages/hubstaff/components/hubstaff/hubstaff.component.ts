import { Component, OnInit, OnDestroy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, tap, catchError, finalize, map } from 'rxjs/operators';
import { IHubstaffOrganization, IHubstaffProject, IOrganization } from '@gauzy/contracts';
import { Observable, of, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ErrorHandlingService, HubstaffService, ToastrService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-hubstaff',
	templateUrl: './hubstaff.component.html',
	styleUrls: ['./hubstaff.component.scss'],
	providers: [TitleCasePipe]
})
export class HubstaffComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	organizations$: Observable<IHubstaffOrganization[]>;
	projects$: Observable<IHubstaffProject[]>;
	organizations: IHubstaffOrganization[] = [];
	projects: IHubstaffProject[] = [];
	organization: IOrganization;
	selectedProjects: IHubstaffProject[] = [];
	loading: boolean;
	integrationId: string;
	supportContextActions: NbMenuItem[];

	constructor(
		private readonly _router: Router,
		public readonly _translateService: TranslateService,
		private readonly _hubstaffService: HubstaffService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _toastrService: ToastrService,
		private readonly _dialogService: NbDialogService,
		private readonly _store: Store,
		private readonly _titlecasePipe: TitleCasePipe,
		private readonly _nbMenuService: NbMenuService
	) {
		super(_translateService);
	}

	ngOnInit() {
		this._loadSettingsSmartTable();
		this._loadActions();
		this._applyTranslationOnSmartTable();
		this._setTokenAndLoadOrganizations();

		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this._nbMenuService
			.onItemClick()
			.pipe(
				map(({ item: { icon } }) => icon),
				untilDestroyed(this)
			)
			.subscribe((icon) => {
				if (icon === 'settings-2-outline') {
					this.setSettings();
				}
			});
	}

	ngOnDestroy(): void {}

	private _setTokenAndLoadOrganizations() {
		this.integrationId = this._activatedRoute.snapshot.params.id;
		this._hubstaffService.getIntegration(this.integrationId).pipe(untilDestroyed(this)).subscribe();

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

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this._loadSettingsSmartTable();
			this._loadActions();
		});
	}

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
					type: 'string'
				},
				description: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'),
					type: 'string'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
					valuePrepareFunction: (_: string) => this._titlecasePipe.transform(_)
				}
			}
		};
	}

	selectOrganization(organization) {
		this.projects$ = organization ? this._fetchProjects(organization) : of([]);
	}

	private _fetchProjects(organization) {
		this.loading = true;
		return this._hubstaffService.getProjects(organization.id, this.integrationId).pipe(
			tap((projects) => (this.projects = projects)),
			catchError((error) => {
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			finalize(() => (this.loading = false))
		);
	}

	selectProject({ selected }) {
		this.selectedProjects = selected;
	}

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
				tap((res) => {
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

	async setSettings() {
		const dialog = this._dialogService.open(SettingsDialogComponent, {
			context: {}
		});

		const data = await firstValueFrom(dialog.onClose);
		if (!data) {
			this._hubstaffService.resetSettings();
			return;
		}

		this._hubstaffService
			.updateSettings(this.integrationId)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.HUBSTAFF_PAGE.SETTINGS_UPDATED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadActions() {
		this.supportContextActions = [
			{
				title: this.getTranslation('INTEGRATIONS.RE_INTEGRATE'),
				icon: 'text-outline',
				link: `pages/integrations/hubstaff/regenerate`
			},
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline'
			}
		];
	}

	/**
	 * Navigate to the "Integrations" page.
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}
}
