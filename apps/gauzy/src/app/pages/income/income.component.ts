import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import {
	IIncome,
	PermissionsEnum,
	ITag,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
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
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_INCOMES_EDIT
				);
			});
		this.store.selectedDate$
			.pipe(untilDestroyed(this))
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
			.pipe(untilDestroyed(this))
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
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this._selectedOrganizationId = organization.id;
				this._loadEmployeeIncomeData(
					this.store.selectedEmployee
						? this.store.selectedEmployee.id
						: null,
					this.store.selectedEmployee &&
						this.store.selectedEmployee.id
						? null
						: this._selectedOrganizationId
				);
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
							clientId: result.organizationContact.clientId,
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
						this.toastrService.primary(
							this.getTranslation('NOTES.INCOME.ADD_INCOME', {
								name: result.employee
									? `${result.employee.firstName} ${result.employee.lastName}`
									: this.getTranslation('SM_TABLE.EMPLOYEE')
							}),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadEmployeeIncomeData(
							this.selectedEmployeeId,
							this.selectedEmployeeId
								? null
								: this._selectedOrganizationId
						);
					} catch (error) {
						this.toastrService.danger(
							this.getTranslation('NOTES.INCOME.INCOME_ERROR', {
								error: error.error
									? error.error.message
									: error.message
							}),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
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
								clientName:
									result.organizationContact.clientName,
								clientId: result.organizationContact.clientId,
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
						this.clearItem();
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
		this.selectedIncome = null;
		const { tenantId } = this.store.user;
		if (orgId) {
			findObj = {
				organizationId: {
					id: orgId
				}
			};
			this.smartTableSettings['columns']['employeeName'] = {
				title: this.getTranslation('SM_TABLE.EMPLOYEE'),
				type: 'string',
				valuePrepareFunction: (_, income: IIncome) => {
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
				['employee', 'employee.user', 'tags', 'organization'],
				Object.assign({}, findObj, { tenantId }),
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

	ngOnDestroy() {
		delete this.smartTableSettings['columns']['employee'];
	}
}
