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
import { debounceTime, filter, takeUntil } from 'rxjs/operators';
import * as moment from 'moment';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { IncomeExpenseAmountComponent } from 'apps/gauzy/src/app/@shared/table-components/income-amount/income-amount.component';
import { DateViewComponent } from 'apps/gauzy/src/app/@shared/table-components/date-view/date-view.component';
import { UpworkStoreService } from '../../../../@core/services/upwork-store.service';
import { IncomeTypeEnum, IOrganization, IUpworkDateRange } from '@gauzy/models';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	selector: 'ngx-reports',
	templateUrl: './reports.component.html',
	styleUrls: ['./reports.component.scss']
})
export class ReportsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {
	reports$: Observable<any> = this._upworkStoreService.reports$;
	settingsSmartTable: object;
	today: Date = new Date();
	defaultDateRange$ = this._upworkStoreService.dateRangeActivity$;
	displayDate: any;
	updateReports$: Subject<any> = new Subject();
	private _ngDestroy$: Subject<void> = new Subject();
	organization: IOrganization;

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
		private readonly _upworkStoreService: UpworkStoreService,
		private readonly _storeService: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this._storeService.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				takeUntil(this._ngDestroy$)
			)
			.subscribe((organization: IOrganization) => {
				this.organization = organization;
				this._setDefaultRange();
			});
		this.updateReports$
			.pipe(
				tap(() => this._getReport()),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	ngAfterViewInit(): void {
		this.cdr.detectChanges();
	}

	private _getReport(): void {
		this._upworkStoreService
			.loadReports(this.organization)
			.pipe(takeUntil(this._ngDestroy$))
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
					width: '10%',
					renderComponent: DateViewComponent,
					filter: false
				},
				type: {
					title: this.getTranslation('SM_TABLE.TRANSACTION_TYPE'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (value, item) => {
						if (item.hasOwnProperty('category')) {
							return item.category ? item.category.name : null;
						}
						return this.getTranslation(
							`INTEGRATIONS.UPWORK_PAGE.${IncomeTypeEnum.HOURLY.toUpperCase()}`
						);
					}
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
					filter: true,
					valuePrepareFunction: (item) => {
						const user = item.user || null;
						if (user) {
							return `${user.firstName} ${user.lastName}`;
						}
					},
					filterFunction(cell?: any, search?: string): boolean {
						if (
							cell.user.firstName.indexOf(search) >= 0 ||
							cell.user.lastName.indexOf(search) >= 0 ||
							search === ''
						) {
							return true;
						} else {
							return false;
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
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadSettingsSmartTable();
			});
	}

	/*
	 * Set 1 month default daterange for filter
	 */
	private _setDefaultRange(): void {
		this.defaultDateRange$ = this._upworkStoreService.dateRangeActivity$.pipe(
			debounceTime(100),
			tap(
				(dateRange) => (
					(this.selectedDateRange = dateRange),
					this.updateReports$.next()
				)
			),
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

	/*
	 * Previous month calendar
	 */
	public previousMonth(): void {
		const { start, end }: IUpworkDateRange = this.selectedDateRange;
		this.selectedDateRange = {
			start: new Date(
				moment(start).subtract(1, 'months').format('YYYY-MM-DD')
			),
			end: new Date(
				moment(end).subtract(1, 'months').format('YYYY-MM-DD')
			)
		};
		this._upworkStoreService.setFilterDateRange(this.selectedDateRange);
	}

	/*
	 * Next month calendar
	 */
	public nextMonth(): void {
		const { start, end }: IUpworkDateRange = this.selectedDateRange;
		this.selectedDateRange = {
			start: new Date(
				moment(start).add(1, 'months').format('YYYY-MM-DD')
			),
			end: new Date(moment(end).add(1, 'months').format('YYYY-MM-DD'))
		};
		if (this.selectedDateRange.start > this.today) {
			this.selectedDateRange.start = new Date(
				moment(this.today).subtract(1, 'months').format('YYYY-MM-DD')
			);
		}
		if (this.selectedDateRange.end > this.today) {
			this.selectedDateRange.end = this.today;
		}
		this._upworkStoreService.setFilterDateRange(this.selectedDateRange);
	}

	/*
	 * Disable next month button
	 */
	public isNextButtonDisabled(): boolean {
		if (!this.selectedDateRange) {
			return true;
		}
		return moment(this.selectedDateRange.end).isSameOrAfter(
			this.today,
			'day'
		);
	}
}
