import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/internal/operators/takeUntil';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { UpworkStoreService } from '../../../../@core/services/upwork-store.service';

@Component({
	selector: 'ngx-reports',
	templateUrl: './reports.component.html',
	styleUrls: ['./reports.component.scss']
})
export class ReportsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	reports$: Observable<any> = this._upworkStoreService.contracts$;
	settingsSmartTable: object;

	constructor(
		public translateService: TranslateService,
		private readonly _upworkStoreService: UpworkStoreService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._upworkStoreService.loadReports();
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private _loadSettingsSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			mode: 'external',
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				date: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'string'
				},
				type: {
					title: this.getTranslation('SM_TABLE.TRANSACTION_TYPE'),
					type: 'string'
				},
				description: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'string'
				},
				client: {
					title: this.getTranslation('SM_TABLE.CLIENT'),
					type: 'string'
				},
				amount: {
					title: this.getTranslation('SM_TABLE.AMOUNT'),
					type: 'string'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadSettingsSmartTable();
			});
	}
}
