import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import {
	Income,
	PermissionsEnum,
	Tag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
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

@Component({
	templateUrl: './income.component.html',
	styleUrls: ['./income.component.scss']
})
export class IncomeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private store: Store,
		private incomeService: IncomeService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
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
	showTable: boolean;
	employeeName: string;
	loading = true;
	hasEditPermission = false;
	tags: Tag[] = [];
	viewComponentName: ComponentEnum;
	incomes: Income[];
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedIncome: Income;

	@ViewChild('incomeTable') incomeTable;

	private _ngDestroy$ = new Subject<void>();
	private _selectedOrganizationId: string;

	async ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_INCOMES_EDIT
				);
			});

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployeeId) {
					this._loadEmployeeIncomeData(this.selectedEmployeeId);
				} else {
					if (this._selectedOrganizationId) {
						this._loadEmployeeIncomeData(
							null,
							this._selectedOrganizationId
						);
					}
				}
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadEmployeeIncomeData(employee.id);
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadEmployeeIncomeData(
							null,
							this._selectedOrganizationId
						);
					}
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					if (this.loading) {
						this._loadEmployeeIncomeData(
							this.store.selectedEmployee
								? this.store.selectedEmployee.id
								: null,
							this.store.selectedEmployee &&
								this.store.selectedEmployee.id
								? null
								: this._selectedOrganizationId
						);
					}
				}
			});

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.addIncome();
				}
			});

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.INCOME;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	canShowTable() {
		if (this.incomeTable) {
			this.incomeTable.grid.dataSet.willSelect = 'false';
		}
		return this.showTable;
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
					title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
					type: 'string'
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
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}

	async addIncome() {
		if (!this.store.selectedDate) {
			this.store.selectedDate = this.store.getDateFromOrganizationSettings();
		}

		const result = await this.dialogService
			.open(IncomeMutationComponent)
			.onClose.pipe(first())
			.toPromise();
		if (result) {
			try {
				await this.incomeService.create({
					amount: result.amount,
					clientName: result.client.clientName,
					clientId: result.client.clientId,
					valueDate: result.valueDate,
					employeeId: result.employee ? result.employee.id : null,
					orgId: this.store.selectedOrganization.id,
					notes: result.notes,
					currency: result.currency,
					isBonus: result.isBonus,
					tags: result.tags
				});

				this.toastrService.primary(
					this.getTranslation('NOTES.INCOME.ADD_INCOME', {
						name: result.employee
							? `${result.employee.firstName} ${result.employee.lastName}`
							: this.getTranslation('SM_TABLE.EMPLOYEE')
					}),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);

				this._loadEmployeeIncomeData();
				this.store.selectedEmployee = result.employee
					? result.employee
					: null;
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation('NOTES.INCOME.INCOME_ERROR', {
						error: error.error ? error.error.message : error.message
					}),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			}
		}
	}

	selectIncome({ isSelected, data }) {
		const selectedIncome = isSelected ? data : null;
		if (this.incomeTable) {
			this.incomeTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedIncome = selectedIncome;
	}

	async editIncome(selectedItem?: Income) {
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
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.incomeService.update(
							this.selectedIncome.id,
							{
								amount: result.amount,
								clientName: result.client.clientName,
								clientId: result.client.clientId,
								valueDate: result.valueDate,
								notes: result.notes,
								currency: result.currency,
								isBonus: result.isBonus,
								tags: result.tags
							}
						);

						this.toastrService.primary(
							this.getTranslation('NOTES.INCOME.EDIT_INCOME', {
								name: this.employeeName
							}),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadEmployeeIncomeData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
						this.selectedIncome = null;
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	async deleteIncome(selectedItem?: Income) {
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
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.incomeService.delete(this.selectedIncome.id);

						this.toastrService.primary(
							this.getTranslation('NOTES.INCOME.DELETE_INCOME', {
								name: this.employeeName
							}),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadEmployeeIncomeData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
						this.selectedIncome = null;
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	private async _loadEmployeeIncomeData(
		employeId = this.selectedEmployeeId,
		orgId?: string
	) {
		let findObj;
		this.showTable = false;
		this.selectedIncome = null;

		if (orgId) {
			findObj = {
				organization: {
					id: orgId
				}
			};
			this.smartTableSettings['columns']['employeeName'] = {
				title: this.getTranslation('SM_TABLE.EMPLOYEE'),
				type: 'string',
				valuePrepareFunction: (_, income: Income) => {
					const user = income.employee ? income.employee.user : null;

					if (user) {
						return `${user.firstName} ${user.lastName}`;
					}
				}
			};
		} else {
			findObj = {
				employee: {
					id: employeId
				}
			};
			delete this.smartTableSettings['columns']['employee'];
		}

		try {
			const { items } = await this.incomeService.getAll(
				['employee', 'employee.user', 'tags'],
				findObj,
				this.selectedDate
			);

			const incomeVM: Income[] = items.map((i) => {
				return {
					id: i.id,
					amount: i.amount,
					clientName: i.clientName,
					clientId: i.clientId,
					valueDate: i.valueDate,
					organization: i.organization,
					employeeId: i.employee ? i.employee.id : null,
					employeeName: i.employee ? i.employee.user.name : null,
					orgId: this.store.selectedOrganization.id,
					notes: i.notes,
					currency: i.currency,
					isBonus: i.isBonus,
					tags: i.tags
				};
			});
			this.smartTableSource.load(items);
			this.incomes = incomeVM;
			this.loading = false;
			this.showTable = true;
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.INCOME.INCOME_ERROR', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
		this.employeeName = this.store.selectedEmployee
			? (
					this.store.selectedEmployee.firstName +
					' ' +
					this.store.selectedEmployee.lastName
			  ).trim()
			: '';
	}

	ngOnDestroy() {
		delete this.smartTableSettings['columns']['employee'];
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
