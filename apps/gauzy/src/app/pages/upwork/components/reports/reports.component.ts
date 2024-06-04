import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/internal/operators/tap';
import { debounceTime, filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { Cell } from 'angular2-smart-table';
import { IncomeTypeEnum, IOrganization, IUpworkDateRange } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { Store } from '@gauzy/ui-sdk/common';
import { IncomeExpenseAmountComponent } from './../../../../@shared/table-components/income-amount/income-amount.component';
import { DateViewComponent } from './../../../../@shared/table-components/date-view/date-view.component';
import { UpworkStoreService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-reports',
	templateUrl: './reports.component.html',
	styleUrls: ['./reports.component.scss']
})
export class ReportsComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	public reports$: Observable<any> = this._upworkStoreService.reports$;
	public settingsSmartTable: object;
	public today: Date = new Date();
	public defaultDateRange$ = this._upworkStoreService.dateRangeActivity$;
	public displayDate: any;
	public updateReports$: Subject<any> = new Subject();
	public organization: IOrganization;

	private _selectedDateRange: IUpworkDateRange;
	public get selectedDateRange(): IUpworkDateRange {
		return this._selectedDateRange;
	}
	public set selectedDateRange(range: IUpworkDateRange) {
		this._selectedDateRange = range;
	}

	constructor(
		private readonly cdr: ChangeDetectorRef,
		public readonly translateService: TranslateService,
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
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._setDefaultRange()),
				untilDestroyed(this)
			)
			.subscribe();
		this.updateReports$
			.pipe(
				tap(() => this._getReport()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	ngAfterViewInit(): void {
		this.cdr.detectChanges();
	}

	private _getReport(): void {
		this._upworkStoreService.loadReports(this.organization).pipe(untilDestroyed(this)).subscribe();
	}

	private _loadSettingsSmartTable(): void {
		this.settingsSmartTable = {
			actions: false,
			mode: 'external',
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.REPORT'),
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '10%',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				type: {
					title: this.getTranslation('SM_TABLE.TRANSACTION_TYPE'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (value, item) => {
						if (item.hasOwnProperty('category')) {
							return item.category ? item.category.name : null;
						}
						return this.getTranslation(`INTEGRATIONS.UPWORK_PAGE.${IncomeTypeEnum.HOURLY.toUpperCase()}`);
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
					renderComponent: IncomeExpenseAmountComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
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
			.pipe(
				tap(() => this._loadSettingsSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Set 1 month default daterange for filter
	 */
	private _setDefaultRange(): void {
		this.defaultDateRange$ = this._upworkStoreService.dateRangeActivity$.pipe(
			debounceTime(100),
			tap((dateRange) => ((this.selectedDateRange = dateRange), this.updateReports$.next(true))),
			tap(
				(dateRange) =>
					(this.displayDate = `${moment(dateRange.start).format('MMM D, YYYY')} - ${moment(
						dateRange.end
					).format('MMM D, YYYY')}`)
			)
		);
	}

	/*
	 * Onchange date range for filter'
	 */
	public handleRangeChange({ start, end }: IUpworkDateRange): void {
		if (moment(start, 'YYYY-MM-DD').isValid() && moment(end, 'YYYY-MM-DD').isValid()) {
			this._upworkStoreService.setFilterDateRange({ start, end });
			this.updateReports$.next(true);
		}
	}

	/*
	 * Previous month calendar
	 */
	public previousMonth(): void {
		const { start, end }: IUpworkDateRange = this.selectedDateRange;
		this.selectedDateRange = {
			start: new Date(moment(start).subtract(1, 'months').format('YYYY-MM-DD')),
			end: new Date(moment(end).subtract(1, 'months').format('YYYY-MM-DD'))
		};
		this._upworkStoreService.setFilterDateRange(this.selectedDateRange);
	}

	/*
	 * Next month calendar
	 */
	public nextMonth(): void {
		const { start, end }: IUpworkDateRange = this.selectedDateRange;
		this.selectedDateRange = {
			start: new Date(moment(start).add(1, 'months').format('YYYY-MM-DD')),
			end: new Date(moment(end).add(1, 'months').format('YYYY-MM-DD'))
		};
		if (this.selectedDateRange.start > this.today) {
			this.selectedDateRange.start = new Date(moment(this.today).subtract(1, 'months').format('YYYY-MM-DD'));
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
		return moment(this.selectedDateRange.end).isSameOrAfter(this.today, 'day');
	}
}
