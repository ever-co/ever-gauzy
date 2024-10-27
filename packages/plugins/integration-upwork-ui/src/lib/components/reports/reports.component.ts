import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, catchError, debounceTime, filter, of, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbCalendarRange } from '@nebular/theme';
import * as moment from 'moment';
import { Cell } from 'angular2-smart-table';
import { IncomeTypeEnum, IOrganization, IUpworkDateRange } from '@gauzy/contracts';
import { Store, UpworkStoreService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DateViewComponent, IncomeExpenseAmountComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-upwork-reports',
	templateUrl: './reports.component.html',
	styleUrls: ['./reports.component.scss']
})
export class ReportsComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	public reports$: Observable<any> = this._upworkStoreService.reports$;
	public settingsSmartTable: any;
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
		this._subscribeToOrganizationAndReports();
	}

	ngAfterViewInit(): void {
		this.cdr.detectChanges();
	}

	/*
	 * Subscribe to selected organization and update reports
	 */
	private _subscribeToOrganizationAndReports(): void {
		this._storeService.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization), // Ensure organization is truthy
				tap((organization: IOrganization) => {
					this.organization = organization; // Set the selected organization
					this._setDefaultRange(); // Set the default date range
				}),
				untilDestroyed(this),
				catchError((error) => {
					console.error('Error retrieving organization:', error);
					return of(null); // Return null or an appropriate default value
				})
			)
			.subscribe();

		this.updateReports$
			.pipe(
				tap(() => this._getReport()), // Call method to get reports
				untilDestroyed(this),
				catchError((error) => {
					console.error('Error updating reports:', error);
					return of(null); // Return null or an appropriate default value
				})
			)
			.subscribe();
	}

	/*
	 * Load reports for the organization
	 */
	private _getReport(): void {
		this._upworkStoreService
			.loadReports(this.organization)
			.pipe(
				untilDestroyed(this),
				tap(() => {
					// Optional: You can set a loading state here if needed
					console.log('Reports are being loaded...');
				}),
				catchError((error) => {
					// Handle error case
					console.error('Failed to load reports:', error);
					// Optionally return a default value or empty result
					return of([]); // Assuming you want to return an empty array in case of error
				})
			)
			.subscribe();
	}

	/**
	 *
	 */
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
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				type: {
					title: this.getTranslation('SM_TABLE.TRANSACTION_TYPE'),
					type: 'string',
					isFilterable: false,
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
					valuePrepareFunction: (value, item) => item.vendor?.name || value
				},
				amount: {
					title: this.getTranslation('SM_TABLE.AMOUNT'),
					type: 'custom',
					width: '15%',
					isFilterable: false,
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
					isFilterable: true,
					valuePrepareFunction: (item) => {
						const { user } = item; // Destructure user directly from item
						return user ? `${user.firstName} ${user.lastName}` : ''; // Return an empty string if user is null or undefined
					},
					filterFunction(cell?: any, search?: string): boolean {
						if (!search) return true; // If there's no search term, return true for all

						const user = cell?.user; // Use optional chaining to safely access user
						return user?.firstName.includes(search) || user?.lastName.includes(search) || false; // Return true if search matches first or last name
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
	 * Set 1 month default date range for filter
	 */
	private _setDefaultRange(): void {
		this.defaultDateRange$ = this._upworkStoreService.dateRangeActivity$.pipe(
			debounceTime(100),
			tap(({ start, end }) => {
				// Set selected date range
				this.selectedDateRange = { start, end };
				// Update report trigger
				this.updateReports$.next(true);
				// Set display date
				this.displayDate = this.formatDateRange(start, end);
			})
		);
	}

	/*
	 * Format date range for display
	 */
	private formatDateRange(start: string | Date, end: string | Date): string {
		return `${moment(start).format('MMM D, YYYY')} - ${moment(end).format('MMM D, YYYY')}`;
	}

	/**
	 * Handles the change in the date range.
	 * This method validates the start and end dates emitted from the calendar component
	 * and updates the filter date range in the Upwork store.
	 *
	 * @param range - The calendar range object containing start and end dates.
	 */
	public handleRangeChange(range: NbCalendarRange<any>): void {
		const { start, end } = range; // Destructure start and end from the emitted range

		// Check if both start and end dates are valid
		if (start && end && moment(start, 'YYYY-MM-DD').isValid() && moment(end, 'YYYY-MM-DD').isValid()) {
			// Update the filter date range in the store
			this._upworkStoreService.setFilterDateRange({ start, end });
			// Trigger report updates
			this.updateReports$.next(true);
		}
	}

	/*
	 * Change month by the specified number of months
	 */
	private changeMonth(months: number): void {
		const { start, end }: IUpworkDateRange = this.selectedDateRange;
		const newStart = moment(start).add(months, 'months').format('YYYY-MM-DD');
		const newEnd = moment(end).add(months, 'months').format('YYYY-MM-DD');

		this.selectedDateRange = {
			start: new Date(newStart),
			end: new Date(newEnd)
		};

		// Ensure the selected range does not exceed today's date
		if (this.selectedDateRange.start > this.today) {
			this.selectedDateRange.start = new Date(moment(this.today).subtract(1, 'months').format('YYYY-MM-DD'));
		}
		if (this.selectedDateRange.end > this.today) {
			this.selectedDateRange.end = this.today;
		}

		this._upworkStoreService.setFilterDateRange(this.selectedDateRange);
	}

	/*
	 * Previous month calendar
	 */
	public previousMonth(): void {
		this.changeMonth(-1);
	}

	/*
	 * Next month calendar
	 */
	public nextMonth(): void {
		this.changeMonth(1);
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

	ngOnDestroy(): void {}
}
