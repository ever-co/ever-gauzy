import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import {
	IIncome,
	ITag,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, tap, withLatestFrom } from 'rxjs/operators';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { IncomeService } from '../../@core/services/income.service';
import { Store } from '../../@core/services/store.service';
import { IncomeMutationComponent } from '../../@shared/income/income-mutation/income-mutation.component';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { IncomeExpenseAmountComponent } from '../../@shared/table-components/income-amount/income-amount.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './income.component.html',
	styleUrls: ['./income.component.scss']
})
export class IncomeComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private store: Store,
		private incomeService: IncomeService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private route: ActivatedRoute,
		private errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService,
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	smartTableSettings: object;
	selectedEmployeeId: string;
	selectedDate: Date;
	smartTableSource = new LocalDataSource();
	disableButton = true;
	employeeName: string;
	loading = true;
	hasEditPermission = false;
	tags: ITag[] = [];
	viewComponentName: ComponentEnum;
	incomes: IIncome[];
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedIncome: IIncome;
	averageIncome = 0;
	averageBonus = 0;

	incomeTable: Ng2SmartTableComponent;
	@ViewChild('incomeTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.incomeTable = content;
			this.onChangedSource();
		}
	}

	private _selectedOrganizationId: string;
	public organization: IOrganization;

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedDate$
			.pipe(untilDestroyed(this))
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedEmployeeId) {
					this._loadEmployeeIncomeData();
				} else {
					if (this._selectedOrganizationId) {
						this._loadEmployeeIncomeData();
					}
				}
			});
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((value) => !!value),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee && this.organization) {
					this.selectedEmployeeId = employee.id;
					this._loadEmployeeIncomeData();
				}
			});
		storeOrganization$
			.pipe(
				filter((value) => !!value),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				if (organization) {
					this.organization = organization;
					this._selectedOrganizationId = organization.id;
					this.selectedEmployeeId = employee ? employee.id : null;
					this._loadEmployeeIncomeData();
				}
			});
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params),
				debounceTime(1000),
				untilDestroyed(this)
			)
			.subscribe((params) => {
				if (params.get('openAddDialog') === 'true') {
					this.addIncome();
				}
			});
		this.router.events
			.pipe(
				filter((event: RouterEvent) => event instanceof NavigationEnd),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.setView();
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.INCOME;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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

	loadSettingsSmartTable() {
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
					type: 'string'
				},
				employeeName: {
					title: this.getTranslation('SM_TABLE.EMPLOYEE'),
					type: 'string',
					valuePrepareFunction: (_, income: IIncome) => {
						const user = income.employee
							? income.employee.user
							: null;
						if (user) {
							return `${user.firstName} ${user.lastName}`;
						}
					}
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
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
	}

	async addIncome() {
		if (!this.store.selectedDate) {
			this.store.selectedDate = this.store.getDateFromOrganizationSettings();
		}

		this.dialogService
			.open(IncomeMutationComponent)
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { tenantId } = this.store.user;
						const { id: organizationId } = this.organization;

						await this.incomeService.create({
							amount: result.amount,
							clientName: result.organizationContact.name,
							clientId: result.organizationContact.id,
							valueDate: result.valueDate,
							employeeId: result.employee
								? result.employee.id
								: null,
							organizationId,
							tenantId,
							notes: result.notes,
							currency: result.currency,
							isBonus: result.isBonus,
							tags: result.tags
						});
						this.toastrService.success('NOTES.INCOME.ADD_INCOME', {
							name: result.employee
								? `${result.employee.firstName} ${result.employee.lastName}`
								: this.getTranslation('SM_TABLE.EMPLOYEE')
						});
						this._loadEmployeeIncomeData();
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
						await this.incomeService.update(
							this.selectedIncome.id,
							{
								amount: result.amount,
								clientName: result.organizationContact.name,
								clientId: result.organizationContact.id,
								valueDate: result.valueDate,
								notes: result.notes,
								currency: result.currency,
								isBonus: result.isBonus,
								tags: result.tags,
								employeeId: this.selectedIncome.employee
									? this.selectedIncome.employee.id
									: null
							}
						);

						this.toastrService.success('NOTES.INCOME.EDIT_INCOME', {
							name: this.employeeName
						});
						this._loadEmployeeIncomeData();
						this.clearItem();
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
						await this.incomeService.delete(
							this.selectedIncome.id,
							this.selectedIncome.employee
								? this.selectedIncome.employee.id
								: null
						);
						this.toastrService.success(
							'NOTES.INCOME.DELETE_INCOME',
							{
								name: this.employeeName
							}
						);
						this._loadEmployeeIncomeData();
						this.clearItem();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	private async _loadEmployeeIncomeData() {
		const { tenantId, employeeId } = this.store.user;
		if (!this._selectedOrganizationId) {
			return;
		}

		const findObj = {
			organizationId: this._selectedOrganizationId,
			tenantId
		};
		if (this.selectedEmployeeId) {
			findObj['employeeId'] = this.selectedEmployeeId;
		}
		if (employeeId) {
			delete this.smartTableSettings['columns']['employeeName'];
			this.smartTableSettings = Object.assign(
				{},
				this.smartTableSettings
			);
		}

		try {
			const { items } = await this.incomeService.getAll(
				['employee', 'employee.user', 'tags', 'organization'],
				findObj,
				this.selectedDate
			);
			const incomeVM: IIncome[] = items.map((i) => {
				return Object.assign({}, i, {
					organizationId: i.organization.id,
					employeeId: i.employee ? i.employee.id : null,
					employeeName: i.employee ? i.employee.user.name : null,
					orgId: this.store.selectedOrganization.id
				});
			});
			this.smartTableSource.load(incomeVM);
			this.incomes = incomeVM;
			this.loading = false;
		} catch (error) {
			this.toastrService.danger(error);
		}
		this.employeeName = this.store.selectedEmployee
			? (
					this.store.selectedEmployee.firstName +
					' ' +
					this.store.selectedEmployee.lastName
			  ).trim()
			: '';
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

	ngOnDestroy() {}
}
