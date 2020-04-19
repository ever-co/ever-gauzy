import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { HubstaffService } from 'apps/gauzy/src/app/@core/services/hubstaff.service';
import { ActivatedRoute } from '@angular/router';
import {
	switchMap,
	tap,
	catchError,
	finalize,
	first,
	takeUntil
} from 'rxjs/operators';
import { IHubstaffOrganization, IHubstaffProject } from '@gauzy/models';
import { Observable, of, Subject } from 'rxjs';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { NbDialogService } from '@nebular/theme';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	selector: 'ngx-hubstaff',
	templateUrl: './hubstaff.component.html',
	styleUrls: ['./hubstaff.component.scss']
})
export class HubstaffComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('projectsTable', { static: false }) projectsTable;
	private _ngDestroy$: Subject<void> = new Subject();
	settingsSmartTable: object;
	organizations$: Observable<IHubstaffOrganization[]>;
	projects$: Observable<IHubstaffProject[]>;
	organizations: IHubstaffOrganization[];
	projects: IHubstaffProject[];
	selectedOrganization: IHubstaffOrganization;
	selectedProjects: IHubstaffProject[];
	loading: boolean = true;
	integrationId: string;
	organizationId: string;

	constructor(
		public translateService: TranslateService,
		private _hubstaffService: HubstaffService,
		private _activatedRoute: ActivatedRoute,
		private _errorHandlingService: ErrorHandlingService,
		private toastrService: ToastrService,
		private _dialogService: NbDialogService,
		private _store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this._setTokenAndloadOrganizations();
		this._store.selectedOrganization$.subscribe(
			(organization) =>
				(this.organizationId = organization ? organization.id : null)
		);
	}

	private _setTokenAndloadOrganizations() {
		this.integrationId = this._activatedRoute.snapshot.params.id;
		this._hubstaffService.getIntegration(this.integrationId).subscribe();
		this.organizations$ = this._hubstaffService
			.getToken(this.integrationId)
			.pipe(
				switchMap(() =>
					this._hubstaffService.getOrganizations(this.integrationId)
				),
				tap((organizations) => (this.organizations = organizations)),
				tap(() => (this.loading = false)),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of([]);
				}),
				finalize(() => (this.loading = false))
			);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}

	loadSettingsSmartTable() {
		this.settingsSmartTable = {
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
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
					filter: false
				}
			}
		};
	}

	selectOrganization(organization) {
		this.projects$ = organization
			? this._fetchProjects(organization)
			: of([]);
	}

	private _fetchProjects(organization) {
		this.loading = true;
		return this._hubstaffService
			.getProjects(organization.id, this.integrationId)
			.pipe(
				tap((projects) => (this.projects = projects)),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of([]);
				}),
				finalize(() => (this.loading = false))
			);
	}

	selectProject({ isSelected, selected }) {
		const selectedProject = isSelected ? selected : null;
		this.projectsTable.grid.dataSet.willSelect = false;
		this.selectedProjects = selectedProject;
	}

	syncProjects() {
		this._hubstaffService
			.syncProjects(
				this.selectedProjects,
				this.integrationId,
				this.organizationId
			)
			.subscribe(
				(res) => {
					this.toastrService.success(
						this.getTranslation(
							'INTEGRATIONS.HUBSTAFF_PAGE.SYNCED_PROJECTS'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				},
				(err) => this._errorHandlingService.handleError(err)
			);
	}

	autoSync() {
		this._hubstaffService
			.autoSync({
				integrationId: this.integrationId,
				hubstaffOrganizations: this.organizations,
				organizationId: this.organizationId
			})
			.pipe(
				tap((res) => {
					this.toastrService.success(
						this.getTranslation(
							'INTEGRATIONS.HUBSTAFF_PAGE.SYNCED_ENTITIES'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of(null);
				}),
				finalize(() => (this.loading = false)),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	async setSettings() {
		const dialog = this._dialogService.open(SettingsDialogComponent, {
			context: {}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (!data) {
			this._hubstaffService.resetSettings();
			return;
		}

		this._hubstaffService
			.updateSettings(this.integrationId)
			.pipe(
				tap(() => {
					this.toastrService.success(
						this.getTranslation(
							'INTEGRATIONS.HUBSTAFF_PAGE.SETTINGS_UPDATED'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
