import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { HubstaffService } from 'apps/gauzy/src/app/@core/services/hubstaff.service';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap, catchError, finalize } from 'rxjs/operators';
import { IHubstaffOrganization, IHubstaffProject } from '@gauzy/models';
import { Observable, of } from 'rxjs';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

@Component({
	selector: 'ngx-hubstaff',
	templateUrl: './hubstaff.component.html',
	styleUrls: ['./hubstaff.component.scss']
})
export class HubstaffComponent extends TranslationBaseComponent
	implements OnInit {
	@ViewChild('projectsTable', { static: false }) projectsTable;
	settingsSmartTable: object;
	organizations$: Observable<IHubstaffOrganization[]>;
	projects$: Observable<IHubstaffProject[]>;
	selectedOrganization: IHubstaffOrganization;
	selectedProjects: IHubstaffProject[];
	loading: boolean = true;
	integrationId: string;

	constructor(
		public translateService: TranslateService,
		private _hubstaffService: HubstaffService,
		private _activatedRoute: ActivatedRoute,
		private _errorHandlingService: ErrorHandlingService,
		private toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this._setTokenAndloadOrganizations();
	}

	private _setTokenAndloadOrganizations() {
		this.integrationId = this._activatedRoute.snapshot.params.id;
		this.organizations$ = this._hubstaffService
			.getToken(this.integrationId)
			.pipe(
				switchMap(() =>
					this._hubstaffService.getOrganizations(this.integrationId)
				),
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
		this.loading = true;
		this.projects$ = this._hubstaffService
			.getProjects(organization.id)
			.pipe(
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
			.syncProjects(this.selectedProjects, this.integrationId)
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
}
