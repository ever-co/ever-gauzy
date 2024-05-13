import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { debounceTime, filter, first, tap, finalize } from 'rxjs/operators';
import { combineLatest, Subject } from 'rxjs';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { ServerDataSource } from '@gauzy/ui-sdk/core';
import { StatusTypesEnum, ITimeOff, ComponentLayoutStyleEnum, IOrganization, IDateRangePicker } from '@gauzy/contracts';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { DateRangePickerBuilderService, Store, TimeOffService, ToastrService } from '../../@core/services';
import { TimeOffHolidayMutationComponent, TimeOffRequestMutationComponent } from '../../@shared/time-off';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import { DateViewComponent, PictureNameTagsComponent } from '../../@shared/table-components';
import { ApprovalPolicyComponent } from '../approvals/table-components';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../@shared/pagination/pagination-filter-base.component';
import { getAdjustDateRangeFutureAllowed } from '../../@theme/components/header/selectors/date-range-picker';
import { InputFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-off',
	templateUrl: './time-off.component.html',
	styleUrls: ['./time-off.component.scss']
})
export class TimeOffComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	selectedEmployeeId: string | null;
	selectedDateRange: IDateRangePicker;
	sourceSmartTable: ServerDataSource;
	timeOffs: ITimeOff[] = [];
	selectedTimeOffRecord: ITimeOff;
	timeOffRequest: ITimeOff;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	rows: Array<any> = [];
	selectedStatus = StatusTypesEnum.ALL;
	timeOffStatuses = Object.keys(StatusTypesEnum);
	loading: boolean;
	isRecordSelected: boolean = false;
	displayHolidays: boolean = true;
	showActions: boolean = false;
	includeArchived: boolean = false;
	showFilter: boolean = false;

	public organization: IOrganization;
	public timeOff$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly timeOffService: TimeOffService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly translate: TranslateService,
		private readonly httpClient: HttpClient,
		private readonly route: ActivatedRoute,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translate);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.timeOff$
			.pipe(
				debounceTime(300),
				tap(() => this.getTimeOffs()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.timeOff$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, selectedDateRange$, storeEmployee$])
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange, employee]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.timeOff$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.requestDaysOff()),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.timeOffs = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.timeOffs = [])),
				tap(() => this.timeOff$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	showAdditionalActions() {
		this.showActions = !this.showActions;
	}

	changeDisplayHolidays(isHoliday: boolean) {
		this.isRecordSelected = false;
		this._refresh$.next(true);
		this.timeOff$.next(true);
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * On status change filter
	 *
	 * @param status
	 */
	detectStatusChange(status: StatusTypesEnum) {
		this.isRecordSelected = false;
		switch (status) {
			case StatusTypesEnum.REQUESTED:
			case StatusTypesEnum.APPROVED:
			case StatusTypesEnum.DENIED:
				this.setFilter({ field: 'status', search: status });
				break;
			default:
				this.setFilter({ field: 'status', search: '' });
				break;
		}
	}

	openTimeOffSettings() {
		this.router.navigate(['/pages/employees/time-off/settings']);
	}

	selectRecord({ isSelected, data }) {
		this.isRecordSelected = isSelected ? true : false;
		this.selectedTimeOffRecord = isSelected ? data : null;
	}

	approveDaysOff(selectedItem?: ITimeOff) {
		if (selectedItem) {
			this.selectRecord({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedTimeOffRecord.status !== StatusTypesEnum.APPROVED) {
			const requestId = this.selectedTimeOffRecord.id;
			this.selectedTimeOffRecord.status = StatusTypesEnum.APPROVED;
			this.timeOffService
				.updateRequestStatus(requestId, 'approval')
				.pipe(untilDestroyed(this), first())
				.subscribe({
					next: () => {
						this.toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.STATUS_SET_APPROVED');
						this._refresh$.next(true);
						this.timeOff$.next(true);
					},
					error: () => this.toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS')
				});
		} else {
			this.toastrService.success(
				'TIME_OFF_PAGE.NOTIFICATIONS.APPROVED_NO_CHANGES',
				'TIME_OFF_PAGE.NOTIFICATIONS.NO_CHANGES'
			);
			this._refresh$.next(true);
			this.timeOff$.next(true);
		}
	}

	denyDaysOff(selectedItem?: ITimeOff) {
		if (selectedItem) {
			this.selectRecord({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedTimeOffRecord.status !== StatusTypesEnum.DENIED) {
			const requestId = this.selectedTimeOffRecord.id;
			this.selectedTimeOffRecord.status = StatusTypesEnum.DENIED;
			this.timeOffService
				.updateRequestStatus(requestId, 'denied')
				.pipe(untilDestroyed(this), first())
				.subscribe({
					next: () => {
						this.toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DENIED');
						this.timeOff$.next(true);
					},
					error: () => this.toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_SET_STATUS')
				});
		} else {
			this.toastrService.success(
				'TIME_OFF_PAGE.NOTIFICATIONS.DENIED_NO_CHANGES',
				'TIME_OFF_PAGE.NOTIFICATIONS.NO_CHANGES'
			);
			this._refresh$.next(true);
			this.timeOff$.next(true);
		}
	}

	deleteRequest(selectedItem?: ITimeOff) {
		if (selectedItem) {
			this.selectRecord({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('TIME_OFF_PAGE.TIME_OFF_REQUEST')
				}
			})
			.onClose.pipe(first())
			.subscribe((res) => {
				if (res) {
					this.timeOffService
						.deleteDaysOffRequest(this.selectedTimeOffRecord.id)
						.pipe(untilDestroyed(this), first())
						.subscribe({
							next: () => {
								this.toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_DELETED');
								this._refresh$.next(true);
								this.timeOff$.next(true);
							},
							error: () => this.toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_DELETE_REQUEST')
						});
				}
			});
	}

	requestDaysOff() {
		this.dialogService
			.open(TimeOffRequestMutationComponent, {
				context: { type: 'request' }
			})
			.onClose.pipe(untilDestroyed(this), first())
			.subscribe((res) => {
				this.timeOffRequest = res;
				this._createRecord();
			});
	}

	addHolidays() {
		this.dialogService
			.open(TimeOffHolidayMutationComponent)
			.onClose.pipe(untilDestroyed(this), first())
			.subscribe((res) => {
				if (res) {
					this.timeOffRequest = res;
					this._createRecord();
				}
			});
	}

	private get _isGridLayout(): boolean {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
	}

	updateTimeOffRecord() {
		this._removeDocUrl();

		this.dialogService
			.open(TimeOffRequestMutationComponent, {
				context: { timeOff: this.selectedTimeOffRecord }
			})
			.onClose.pipe(untilDestroyed(this), first())
			.subscribe((res) => {
				if (res) {
					const requestId = this.selectedTimeOffRecord.id;
					this.timeOffRequest = res;
					this._updateRecord(requestId);
				}
			});
	}

	archive() {
		const requestId = this.selectedTimeOffRecord.id;
		this.selectedTimeOffRecord.isArchived = true;
		this.timeOffRequest = this.selectedTimeOffRecord;
		this._updateRecord(requestId);
	}

	changeIncludeArchived($event) {
		this._refresh$.next(true);
		this.timeOff$.next(true);
	}

	/**
	 * Load smart table settings configuration
	 *
	 */
	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.TIME_OFF'),
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					type: 'custom',
					class: 'align-row',
					renderComponent: PictureNameTagsComponent,
					componentInitFunction: (instance: PictureNameTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({
							field: 'user.firstName',
							search: value
						});
					}
				},
				extendedDescription: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'),
					type: 'html',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'description', search: value });
					}
				},
				policy: {
					title: this.getTranslation('SM_TABLE.POLICY'),
					type: 'custom',
					renderComponent: ApprovalPolicyComponent,
					componentInitFunction: (instance: ApprovalPolicyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'policy.name', search: value });
					}
				},
				start: {
					title: this.getTranslation('SM_TABLE.START'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				end: {
					title: this.getTranslation('SM_TABLE.END'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				requestDate: {
					title: this.getTranslation('SM_TABLE.REQUEST_DATE'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				statusBadge: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					filter: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				}
			}
		};
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);

			this.sourceSmartTable = new ServerDataSource(this.httpClient, {
				endPoint: `${API_PREFIX}/time-off-request/pagination`,
				relations: ['policy', 'document', 'employees.user'],
				join: {
					alias: 'time_off_request',
					leftJoin: {
						policy: 'time_off_request.policy',
						employees: 'time_off_request.employees',
						user: 'employees.user'
					},
					...(this.filters.join ? this.filters.join : {})
				},
				where: {
					organizationId,
					tenantId,
					isHoliday: !this.displayHolidays,
					includeArchived: this.includeArchived,
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
					...(this.selectedEmployeeId ? { employeeIds: [this.selectedEmployeeId] } : {}),
					...(this.filters.where ? this.filters.where : {})
				},
				resultMap: (timeOff: ITimeOff) => {
					return Object.assign({}, timeOff, this.mapTimeOffRequest(timeOff));
				},
				finalize: () => {
					if (this._isGridLayout) this.timeOffs.push(...this.sourceSmartTable.getData());
					this.setPagination({
						...this.getPagination(),
						totalItems: this.sourceSmartTable.count()
					});
					this.loading = false;
				}
			});
		} finally {
			this.loading = false;
		}
	}

	/**
	 * GET time off requests
	 *
	 * @returns
	 */
	private async getTimeOffs() {
		if (!this.organization) {
			return;
		}
		this.setSmartTableSource();
		try {
			const { activePage, itemsPerPage } = this.getPagination();
			this.sourceSmartTable.setPaging(activePage, itemsPerPage, false);
			this._loadGridLayoutData();
		} catch (error) {
			this.toastrService.danger(error, 'TIME_OFF_PAGE.NOTIFICATIONS.ERR_LOAD_RECORDS');
		}
	}

	/**
	 * Mapped Time Off Requests
	 *
	 * @param timeOff
	 * @returns
	 */
	mapTimeOffRequest(timeOff: ITimeOff) {
		let employeeName: string;
		let employeeImage: string;
		let extendedDescription = '';

		if (timeOff.employees.length !== 1) {
			employeeName = this.getTranslation('TIME_OFF_PAGE.MULTIPLE_EMPLOYEES');
			employeeImage = 'assets/images/avatars/people-outline.svg';
		} else {
			employeeName = `${timeOff.employees[0].fullName}`;
			employeeImage = timeOff.employees[0].user.imageUrl;
		}
		if (timeOff.documentUrl) {
			extendedDescription = `<a href=${timeOff.documentUrl} target="_blank">${this.getTranslation(
				'TIME_OFF_PAGE.VIEW_REQUEST_DOCUMENT'
			)}</a><br>${timeOff.description}`;
		} else {
			extendedDescription = timeOff.description;
		}
		return {
			fullName: employeeName,
			imageUrl: employeeImage,
			extendedDescription: extendedDescription,
			statusBadge: this.statusMapper(timeOff.status)
		};
	}

	private async _loadGridLayoutData() {
		if (this._isGridLayout) await this.sourceSmartTable.getElements();
	}

	private _createRecord() {
		try {
			if (this.timeOffRequest) {
				this.timeOffService
					.createRequest(this.timeOffRequest)
					.pipe(
						untilDestroyed(this),
						first(),
						tap(() => this.toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.RECORD_CREATED')),
						tap(() =>
							this.dateRangePickerBuilderService.refreshDateRangePicker(moment(this.timeOffRequest.start))
						),
						finalize(() => {
							this._refresh$.next(true);
							this.timeOff$.next(true);
						})
					)
					.subscribe();
			}
		} catch (error) {
			this.toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_CREATE_RECORD');
		}
	}

	private _updateRecord(id: string) {
		try {
			this.timeOffService
				.updateRequest(id, this.timeOffRequest)
				.pipe(
					untilDestroyed(this),
					first(),
					tap(() => this.toastrService.success('TIME_OFF_PAGE.NOTIFICATIONS.REQUEST_UPDATED')),
					tap(() =>
						this.dateRangePickerBuilderService.refreshDateRangePicker(moment(this.timeOffRequest.start))
					),
					finalize(() => {
						this._refresh$.next(true);
						this.timeOff$.next(true);
					})
				)
				.subscribe();
		} catch (error) {
			this.toastrService.danger('TIME_OFF_PAGE.NOTIFICATIONS.ERR_UPDATE_RECORD');
		}
	}

	private _removeDocUrl() {
		if (this.selectedTimeOffRecord.description) {
			const index = this.selectedTimeOffRecord.description.lastIndexOf('>');
			const nativeDescription = this.selectedTimeOffRecord.description;
			this.selectedTimeOffRecord.description = nativeDescription.substring(index + 1);
		}
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectRecord({
			isSelected: false,
			data: null
		});
	}

	/**
	 * Navigate to employee edit section
	 *
	 * @param row
	 */
	navigateToEmployee(row: ITimeOff) {
		if (row?.employees.length > 0) {
			this.router.navigate([`/pages/employees/edit`, row.employees[0].id]);
		}
	}

	private statusMapper(value: any) {
		let badgeClass;
		if (value) {
			badgeClass = [StatusTypesEnum.APPROVED].includes(value.toUpperCase())
				? 'success'
				: [StatusTypesEnum.REQUESTED].includes(value.toUpperCase())
				? 'warning'
				: 'danger';
		}
		return {
			text: value,
			class: badgeClass
		};
	}

	ngOnDestroy(): void {}
}
