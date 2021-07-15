import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ActivatedRoute
} from '@angular/router';
import {
	IIncome,
	ComponentLayoutStyleEnum,
	IOrganization,
	IEmployee,
	IOrganizationContact,
	ITag
} from '@gauzy/contracts';
import { Subject } from 'rxjs/internal/Subject';
import { combineLatest } from 'rxjs';
import { distinctUntilChange } from '@gauzy/common-angular';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { IncomeMutationComponent } from '../../@shared/income/income-mutation/income-mutation.component';
import { DateViewComponent, IncomeExpenseAmountComponent, NotesWithTagsComponent } from '../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { ServerDataSource } from '../../@core/utils/smart-table/server.data-source';
import { ErrorHandlingService, IncomeService, Store, ToastrService } from '../../@core/services';
import { ALL_EMPLOYEES_SELECTED } from '../../@theme/components/header/selectors/employee';
import { OrganizationContactFilterComponent, TagsColorFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './income.component.html',
	styleUrls: ['./income.component.scss']
})
export class IncomeComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	smartTableSettings: object;
	selectedEmployeeId: string;
	selectedDate: Date;
	smartTableSource: ServerDataSource;
	disableButton = true;
	loading: boolean;
	viewComponentName: ComponentEnum;
	incomes: IIncome[];
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	selectedIncome: IIncome;
	public organization: IOrganization;
	subject$: Subject<any> = new Subject();

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
	@ViewChild('actionButtons', { static : true }) actionButtons : TemplateRef<any>;

	constructor(
		private readonly store: Store,
		private readonly incomeService: IncomeService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		private readonly errorHandler: ErrorHandlingService,
		public readonly translateService: TranslateService,
		private readonly httpClient: HttpClient,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getIncomes()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const selectedDate$ = this.store.selectedDate$;
		combineLatest([storeOrganization$, storeEmployee$, selectedDate$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(([organization, employee, date]) => {
					if (organization) {
						this.selectedDate = date;
						this.selectedEmployeeId = employee ? employee.id : null;

						this.refreshPagination();
						this.subject$.next();
					}
				}),
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
		this.cdr.detectChanges();
	}

	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
			delete this.smartTableSettings['columns']['employeeName'];
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.INCOME;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.subject$.next()),
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
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		this.smartTableSettings = {
			actions: false,
			mode: 'external',
			editable: true,
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
					title: this.getTranslation('SM_TABLE.CONTACT_NAME'),
					type: 'string',
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact| null) => {
						this.setFilter({ field: 'clientId', search: (value)?.id || null });
					}
				},
				employeeName: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					type: 'string',
					filter: false,
					sort: false
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
					class: 'align-row',
					renderComponent: NotesWithTagsComponent,
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
			},
			pager: {
				display: true,
				perPage: this.pagination.itemsPerPage
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
		if (!this.store.selectedDate) {
			this.store.selectedDate = this.store.getDateFromOrganizationSettings();
		}
		this.dialogService
			.open(IncomeMutationComponent)
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { tenantId } = this.store.user;
						const { id: organizationId } = this.organization;
						const { amount, organizationContact, valueDate, employee, notes, currency, isBonus, tags } = result;
						await this.incomeService.create({
							amount,
							clientName: organizationContact.name,
							clientId: organizationContact.id,
							valueDate,
							employeeId: employee ? employee.id : null,
							organizationId,
							tenantId,
							notes,
							currency,
							isBonus,
							tags
						})
						.then(() => {
							this.toastrService.success('NOTES.INCOME.ADD_INCOME', {
								name: this.employeeName(employee)
							});
						})
						.finally(() => {
							this.subject$.next();
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
						const { amount, organizationContact, valueDate, notes, currency, isBonus, tags } = result;
						const { employee } = this.selectedIncome;
						await this.incomeService.update(this.selectedIncome.id, {
							amount,
							clientName: organizationContact.name,
							clientId: organizationContact.id,
							valueDate,
							notes,
							currency,
							isBonus,
							tags,
							employeeId: employee ? employee.id : null
						}).then(() => {
							this.toastrService.success('NOTES.INCOME.EDIT_INCOME', {
								name: this.employeeName(employee)
							});
						})
						.finally(() => {
							this.subject$.next();
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
						await this.incomeService.delete(
							id,
							employee ? employee.id : null
						)
						.then(() => { 
							this.toastrService.success('NOTES.INCOME.DELETE_INCOME', {
								name: this.employeeName(employee)
							});
						})
						.finally(() => {
							this.subject$.next();
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.selectedEmployeeId) {
			request['employeeId'] = this.selectedEmployeeId;
		}
		if (moment(this.selectedDate).isValid()) {
			request['valueDate'] = moment(this.selectedDate).format('YYYY-MM-DD HH:mm:ss');
		}
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/income/search/filter`,
			relations: [
				'employee', 
				'employee.user', 
				'tags', 
				'organization'
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
					employeeName: income.employee ? income.employee.fullName : null,
				});
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	private async getIncomes() {
		try { 
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.incomes = this.smartTableSource.getData();

				this.pagination['totalItems'] =  this.smartTableSource.count();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
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
		return (
			employee && employee.id
		) ? (employee.fullName).trim() : ALL_EMPLOYEES_SELECTED.firstName;
	}

	ngOnDestroy() { }
}
