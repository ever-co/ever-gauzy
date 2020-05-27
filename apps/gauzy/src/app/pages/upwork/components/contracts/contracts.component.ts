import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { UpworkStoreService } from 'apps/gauzy/src/app/@core/services/upwork-store.service';
import { IEngagement } from '@gauzy/models';
import { Observable, of, EMPTY, Subject } from 'rxjs';
import { DateViewComponent } from 'apps/gauzy/src/app/@shared/table-components/date-view/date-view.component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, tap, takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';

@Component({
	selector: 'ngx-contracts',
	templateUrl: './contracts.component.html',
	styleUrls: ['./contracts.component.scss'],
})
export class ContractsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('contractsTable', { static: false }) contractsTable;
	private _ngDestroy$: Subject<void> = new Subject();
	contracts$: Observable<IEngagement[]> = this._us.contracts$;
	smartTableSettings;
	selectedContracts: IEngagement[];

	constructor(
		private _us: UpworkStoreService,
		private toastrService: NbToastrService,
		private _ehs: ErrorHandlingService,
		public translateService: TranslateService
	) {
		super(translateService);
		this._loagContracts();
	}

	private _loagContracts() {
		this._us
			.getContracts()
			.pipe(
				catchError((error) => {
					this._ehs.handleError(error);
					return of(null);
				}),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			selectMode: 'multi',
			actions: {
				add: false,
				edit: false,
				delete: false,
				select: true,
			},
			mode: 'external',
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				engagement_start_date: {
					title: this.getTranslation('SM_TABLE.START_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false,
				},
				engagement_end_date: {
					title: this.getTranslation('SM_TABLE.END_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false,
				},
				job__title: {
					title: this.getTranslation('SM_TABLE.JOB_TITLE'),
					type: 'string',
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
				},
			},
		};
	}

	selectContracts({ isSelected, selected }) {
		const selectedContracts = isSelected ? selected : null;
		this.contractsTable.grid.dataSet.willSelect = false;
		this.selectedContracts = selectedContracts;
	}

	syncContracts() {
		this._us
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
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
