import {
	Component,
	OnInit,
	OnDestroy,
	ChangeDetectorRef,
	AfterViewInit
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/internal/operators/tap';
import { debounceTime } from 'rxjs/internal/operators/debounceTime';
import { untilDestroyed } from 'ngx-take-until-destroy';
import * as moment from 'moment';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { IncomeExpenseAmountComponent } from 'apps/gauzy/src/app/@shared/table-components/income-amount/income-amount.component';
import { DateViewComponent } from 'apps/gauzy/src/app/@shared/table-components/date-view/date-view.component';
import { UpworkStoreService } from '../../../../@core/services/upwork-store.service';
import { IUpworkDateRange } from '@gauzy/models';

@Component({
	selector: 'ngx-reports',
	templateUrl: './reports.component.html',
	styleUrls: ['./reports.component.scss']
})
export class ReportsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {
	reports$: Observable<any> = this._upworkStoreService.reports$;
	settingsSmartTable: object;
	maxDate: Date = new Date();
	defaultDateRange$;
	displayDate: any;
	updateReports$: Subject<any> = new Subject();

	private _selectedDateRange: IUpworkDateRange;
	public get selectedDateRange(): IUpworkDateRange {
		return this._selectedDateRange;
	}
	public set selectedDateRange(range: IUpworkDateRange) {
		this._selectedDateRange = range;
	}

	constructor(
		private readonly cdr: ChangeDetectorRef,
		public translateService: TranslateService,
		private readonly _upworkStoreService: UpworkStoreService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this._setDefaultRange();

		this.updateReports$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this._getReport();
			});
		this.updateReports$.next();
	}

	ngOnDestroy(): void {}

	ngAfterViewInit(): void {
		this.cdr.detectChanges();
	}

	private _getReport(): void {
		this._upworkStoreService
			.loadReports()
			.pipe(untilDestroyed(this))
			.subscribe();
	}

	private _loadSettingsSmartTable(): void {
		this.settingsSmartTable = {
			actions: false,
			mode: 'external',
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '20%',
					renderComponent: DateViewComponent,
					filter: false
				},
				clientName: {
					title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
					type: 'string',
					valuePrepareFunction: (value, item) => {
						if (item.hasOwnProperty('vendor')) {
							return item.vendor ? item.vendor.name : null;
						}
						return value;
					}
				},
				amount: {
					title: this.getTranslation('SM_TABLE.AMOUNT'),
					type: 'custom',
					width: '15%',
					filter: false,
					renderComponent: IncomeExpenseAmountComponent
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'string'
				},
				employee: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					type: 'string',
					valuePrepareFunction: (item) => {
						const user = item.user || null;
						if (user) {
							return `${user.firstName} ${user.lastName}`;
						}
					}
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this._loadSettingsSmartTable();
			});
	}

	/*
	 * Set 1 month default daterange for filter
	 */
	private _setDefaultRange(): void {
		this.defaultDateRange$ = this._upworkStoreService.dateRangeActivity$.pipe(
			tap((dateRange) => (this.selectedDateRange = dateRange)),
			tap(
				(dateRange) =>
					(this.displayDate = `${moment(dateRange.start).format(
						'MMM D, YYYY'
					)} - ${moment(dateRange.end).format('MMM D, YYYY')}`)
			)
		);
	}

	/*
	 * Onchange date range for filter'
	 */
	public handleRangeChange({ start, end }: IUpworkDateRange): void {
		if (
			moment(start, 'YYYY-MM-DD').isValid() &&
			moment(end, 'YYYY-MM-DD').isValid()
		) {
			this._upworkStoreService.setFilterDateRange({ start, end });
			this.updateReports$.next();
		}
	}

	public previousMonth() {
		const { start, end } = this.selectedDateRange;
		this.selectedDateRange = {
			start: new Date(
				moment(start).subtract(1, 'months').format('YYYY-MM-DD')
			),
			end: new Date(
				moment(end).subtract(1, 'months').format('YYYY-MM-DD')
			)
		};
	}

	public nextMonth() {
		console.log(this.selectedDateRange);
	}
}
