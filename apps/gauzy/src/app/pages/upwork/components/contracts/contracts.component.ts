import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { IEngagement } from '@gauzy/contracts';
import { Observable, of, EMPTY } from 'rxjs';
import { catchError, tap, first } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import * as moment from 'moment';
import {
	ErrorHandlingService,
	ToastrService,
	UpworkStoreService
} from './../../../../@core/services';
import { DateViewComponent } from './../../../../@shared/table-components';
import { TranslationBaseComponent } from './../../../../@shared/language-base';
import { SyncDataSelectionComponent } from '../sync-data-selection/sync-data-selection.component';

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

	contractsTable: Ng2SmartTableComponent;
	@ViewChild('contractsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.contractsTable = content;
		}
	}

	contracts$: Observable<IEngagement[]> = this._upworkStoreServices.contracts$;
	smartTableSettings: any;
	selectedContracts: IEngagement[] = [];

	constructor(
		private readonly _upworkStoreServices: UpworkStoreService,
		private readonly toastrService: ToastrService,
		private readonly _ehs: ErrorHandlingService,
		public readonly translateService: TranslateService,
		private readonly _ds: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly titleCasePipe: TitleCasePipe
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
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.route.queryParamMap
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.manageEntitiesSync();
				}
			});
	}

	_loadSmartTableSettings() {
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
					filter: false,
					valuePrepareFunction: (date: string) => {
						if (date) {
							return moment.unix(parseInt(date) / 1000);
						}
					}
				},
				engagement_end_date: {
					title: this.getTranslation('SM_TABLE.END_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false,
					valuePrepareFunction: (date: string) => {
						if (date) {
							return moment.unix(parseInt(date) / 1000);
						}
					}
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
		if (this.contractsTable) {
			this.contractsTable.grid.dataSet['willSelect'] = 'false';
		}
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
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
