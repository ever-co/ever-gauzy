import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
	IIncome,
	ComponentLayoutStyleEnum,
	IOrganization,
	IEmployee,
	IOrganizationContact,
	ITag,
	IDateRangePicker
} from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { combineLatest } from 'rxjs';
import { distinctUntilChange, employeeMapper, toUTC } from '@gauzy/common-angular';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { IncomeMutationComponent } from '../../@shared/income/income-mutation/income-mutation.component';
import {
	ContactLinksComponent,
	DateViewComponent,
	EmployeeLinksComponent,
	IncomeExpenseAmountComponent,
	TagsOnlyComponent
} from '../../@shared/table-components';
import {
	OrganizationContactFilterComponent,
	TagsColorFilterComponent
} from '../../@shared/table-filters';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { ServerDataSource } from '../../@core/utils/smart-table/server.data-source';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	IncomeService,
	Store,
	ToastrService
} from '../../@core/services';
import { ALL_EMPLOYEES_SELECTED } from '../../@theme/components/header/selectors/employee';
import { getAdjustDateRangeFutureAllowed } from '../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './income.component.html',
	styleUrls: ['./income.component.scss']
})
export class IncomeComponent extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	smartTableSettings: object;
	selectedEmployeeId: string;
	selectedDateRange: IDateRangePicker;
	smartTableSource: ServerDataSource;
	disableButton: boolean = true;
	loading: boolean = false;
	viewComponentName: ComponentEnum;
	incomes: IIncome[] = [];
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	selectedIncome: IIncome;

	public organization: IOrganization;
	incomes$: Subject<any> = this.subject$;

	incomeTable: Ng2SmartTableComponent;
	@ViewChild('incomeTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.incomeTable = content;
			this.onChangedSource();
		}
	}

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true }) actionButtons: TemplateRef<any>;

	constructor(
		private readonly store: Store,
		private readonly incomeService: IncomeService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		private readonly errorHandler: ErrorHandlingService,
		public readonly translateService: TranslateService,
		private readonly httpClient: HttpClient,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.incomes$
			.pipe(
				debounceTime(100),
				tap(() => this._clearItem()),
				tap(() => this.getIncomes()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.incomes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, storeEmployee$, selectedDateRange$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, employee, dateRange]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this.refreshPagination()),
				tap(() => this.incomes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.addIncome()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
			this.smartTableSettings = Object.assign(
				{},
				this.smartTableSettings
			);
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.INCOME;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.incomes$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.incomeTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this._clearItem())
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '15%',
					renderComponent: DateViewComponent,
					filter: false
				},
				client: {
					title: this.getTranslation('SM_TABLE.CONTACT'),
					type: 'custom',
					renderComponent: ContactLinksComponent,
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact | null) => {
						this.setFilter({
							field: 'clientId',
							search: value?.id || null
						});
					}
				},
				employee: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					filter: false,
					type: 'custom',
					sort: false,
					renderComponent: EmployeeLinksComponent
				},
				amount: {
					title: this.getTranslation('SM_TABLE.VALUE'),
					type: 'custom',
					width: '15%',
					filter: false,
					renderComponent: IncomeExpenseAmountComponent
				},
				notes: {
					title: this.getTranslation('SM_TABLE.NOTES'),
					type: 'text',
					class: 'align-row'
				},
				tags: {
					title: this.getTranslation('SM_TABLE.TAGS'),
					type: 'custom',
					width: '10%',
					class: 'align-row',
					renderComponent: TagsOnlyComponent,
					filter: {
						type: 'custom',
						component: TagsColorFilterComponent
					},
					filterFunction: (tags: ITag[]) => {
						const tagIds = [];
						for (const tag of tags) {
							tagIds.push(tag.id);
						}
						this.setFilter({ field: 'tags', search: tagIds });
					},
					sort: false
				}
			}
		};
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async addIncome() {
		this.dialogService
			.open(IncomeMutationComponent)
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { tenantId } = this.store.user;
						const { id: organizationId } = this.organization;
						const {
							amount,
							organizationContact,
							valueDate,
							employee,
							notes,
							currency,
							isBonus,
							tags
						} = result;
						await this.incomeService
							.create({
								amount,
								clientId: organizationContact.id,
								valueDate: moment(valueDate).startOf('day').toDate(),
								employeeId: employee ? employee.id : null,
								organizationId,
								tenantId,
								notes,
								currency,
								isBonus,
								tags
							})
							.then(() => {
								this.toastrService.success(
									'NOTES.INCOME.ADD_INCOME',
									{
										name: this.employeeName(employee)
									}
								);
							})
							.finally(() => {
								this.dateRangePickerBuilderService.refreshDateRangePicker(
									moment(valueDate)
								);
								this.incomes$.next(true);
							});
					} catch (error) {
						this.toastrService.danger(error);
					}
				}
			});
	}

	selectIncome({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedIncome = isSelected ? data : null;
	}

	async editIncome(selectedItem?: IIncome) {
		if (selectedItem) {
			this.selectIncome({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(IncomeMutationComponent, {
				context: {
					income: this.selectedIncome
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const {
							amount,
							organizationContact,
							valueDate,
							notes,
							currency,
							isBonus,
							tags
						} = result;
						const { employee } = this.selectedIncome;

						const { tenantId } = this.store.user;
						const { id: organizationId } = this.organization;

						await this.incomeService
							.update(this.selectedIncome.id, {
								amount,
								clientId: organizationContact.id,
								valueDate: moment(valueDate).startOf('day').toDate(),
								notes,
								currency,
								isBonus,
								tags,
								employeeId: employee ? employee.id : null,
								tenantId,
								organizationId
							})
							.then(() => {
								this.toastrService.success(
									'NOTES.INCOME.EDIT_INCOME',
									{
										name: this.employeeName(employee)
									}
								);
							})
							.finally(() => {
								this.dateRangePickerBuilderService.refreshDateRangePicker(
									moment(valueDate)
								);
								this.incomes$.next(true);
							});
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	async deleteIncome(selectedItem?: IIncome) {
		if (selectedItem) {
			this.selectIncome({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('INCOME_PAGE.INCOME')
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { id, employee } = this.selectedIncome;
						await this.incomeService
							.delete(id, employee ? employee.id : null)
							.then(() => {
								this.toastrService.success(
									'NOTES.INCOME.DELETE_INCOME',
									{
										name: this.employeeName(employee)
									}
								);
							})
							.finally(() => {
								this.incomes$.next(true);
							});
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.selectedEmployeeId) request['employeeId'] = this.selectedEmployeeId;

		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);
		if (startDate && endDate) {
			request['valueDate'] = {};
			if (moment(startDate).isValid()) {
				request['valueDate']['startDate'] = toUTC(startDate).format('YYYY-MM-DD HH:mm:ss');
			}
			if (moment(endDate).isValid()) {
				request['valueDate']['endDate'] = toUTC(endDate).format('YYYY-MM-DD HH:mm:ss');
			}
		}

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/income/pagination`,
			relations: [
				'employee',
				'employee.user',
				'tags',
				'organization',
				'client'
			],
			join: {
				alias: 'income',
				leftJoin: {
					tags: 'income.tags'
				}
			},
			where: {
				...{ organizationId, tenantId },
				...request,
				...this.filters.where
			},
			resultMap: (income: IIncome) => {
				return Object.assign({}, income, {
					employeeName: income.employee
						? income.employee.fullName
						: null,
					clientName: income.client ? income.client.name : null,
					employee: { ...employeeMapper(income) }
				});
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	private async getIncomes() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.incomes = this.smartTableSource.getData();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/*
	 * Clear selected item
	 */
	private _clearItem() {
		this.selectIncome({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.incomeTable && this.incomeTable.grid) {
			this.incomeTable.grid.dataSet['willSelect'] = 'false';
			this.incomeTable.grid.dataSet.deselectAll();
		}
	}

	employeeName(employee: IEmployee) {
		return employee && employee.id
			? employee.fullName.trim()
			: ALL_EMPLOYEES_SELECTED.firstName;
	}

	ngOnDestroy() {}
}
