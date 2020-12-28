import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { UpworkStoreService } from 'apps/gauzy/src/app/@core/services/upwork-store.service';
import { IEngagement } from '@gauzy/models';
import { Observable, of, EMPTY } from 'rxjs';
import { DateViewComponent } from 'apps/gauzy/src/app/@shared/table-components/date-view/date-view.component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, tap, first } from 'rxjs/operators';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { SyncDataSelectionComponent } from '../sync-data-selection/sync-data-selection.component';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-contracts',
	templateUrl: './contracts.component.html',
	styleUrls: ['./contracts.component.scss'],
	providers: [TitleCasePipe]
})
export class ContractsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('contractsTable', { static: false }) contractsTable;
	contracts$: Observable<IEngagement[]> = this._upworkStoreServices
		.contracts$;
	smartTableSettings;
	selectedContracts: IEngagement[] = [];

	constructor(
		private _upworkStoreServices: UpworkStoreService,
		private toastrService: ToastrService,
		private _ehs: ErrorHandlingService,
		public translateService: TranslateService,
		private _ds: NbDialogService,
		private route: ActivatedRoute,
		private titleCasePipe: TitleCasePipe
	) {
		super(translateService);
		this._loadContracts();
	}

	private _loadContracts() {
		this._upworkStoreServices
			.getContracts()
			.pipe(
				catchError((error) => {
					this._ehs.handleError(error);
					return of(null);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.route.queryParamMap
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.manageEntitiesSync();
				}
			});
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			selectMode: 'multi',
			actions: {
				add: false,
				edit: false,
				delete: false,
				select: true
			},
			mode: 'external',
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				engagement_start_date: {
					title: this.getTranslation('SM_TABLE.START_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
				},
				engagement_end_date: {
					title: this.getTranslation('SM_TABLE.END_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
				},
				job__title: {
					title: this.getTranslation('SM_TABLE.JOB_TITLE'),
					type: 'string'
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
					valuePrepareFunction: (data: string) => {
						return this.titleCasePipe.transform(data);
					}
				}
			}
		};
	}

	selectContracts({ selected }) {
		this.contractsTable.grid.dataSet.willSelect = false;
		this.selectedContracts = selected;
	}

	async manageEntitiesSync() {
		const dialog = this._ds.open(SyncDataSelectionComponent, {
			context: {
				contracts: this.selectedContracts
			}
		});

		await dialog.onClose.pipe(first()).toPromise();
	}

	syncContracts() {
		this._upworkStoreServices
			.syncContracts(this.selectedContracts)
			.pipe(
				tap(() => {
					this.toastrService.success(
						this.getTranslation(
							'INTEGRATIONS.UPWORK_PAGE.SYNCED_CONTRACTS'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((err) => {
					this._ehs.handleError(err);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
	}

	ngOnDestroy() {}
}
