import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import {
	FormBuilder,
	Validators,
	FormGroup,
	AbstractControl
} from '@angular/forms';
import {
	TaxTypesEnum,
	ExpenseTypesEnum,
	IOrganizationVendor,
	ITag,
	IOrganizationContact,
	IOrganizationProject,
	ExpenseStatusesEnum,
	IOrganizationExpenseCategory,
	ContactType,
	IExpenseViewModel,
	ICurrency
} from '@gauzy/contracts';
import { Store } from '../../../@core/services/store.service';
import {
	EmployeeSelectorComponent,
	ALL_EMPLOYEES_SELECTED,
	SelectedEmployee
} from '../../../@theme/components/header/selectors/employee/employee.component';
import { OrganizationVendorsService } from '../../../@core/services/organization-vendors.service';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { AttachReceiptComponent } from './attach-receipt/attach-receipt.component';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { OrganizationExpenseCategoriesService } from '../../../@core/services/organization-expense-categories.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expenses-mutation',
	templateUrl: './expenses-mutation.component.html',
	styleUrls: ['./expenses-mutation.component.scss']
})
export class ExpensesMutationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	form: FormGroup;
	expense: IExpenseViewModel;
	organizationId: string;
	tenantId: string;
	typeOfExpense: string;
	expenseTypes = Object.values(ExpenseTypesEnum);
	taxTypes = Object.values(TaxTypesEnum);
	expenseStatuses = Object.values(ExpenseStatusesEnum);
	expenseCategories: IOrganizationExpenseCategory[];
	vendors: IOrganizationVendor[];
	organizationContact: IOrganizationContact;
	organizationContacts: {
		name: string;
		organizationContactId: string;
	}[] = [];
	project: IOrganizationProject;
	projects: { name: string; projectId: string }[] = [];
	defaultImage = './assets/images/others/invoice-template.png';
	calculatedValue = '0';
	duplicate: boolean;
	showNotes = false;
	_showTaxesInput = false;
	showWarning = false;
	disable = true;
	loading = false;
	tags: ITag[] = [];
	selectedTags: any;
	valueDate: AbstractControl;
	amount: AbstractControl;
	notes: AbstractControl;
	showTooltip = false;
	disableStatuses = false;
	averageExpense = 0;
	translatedTaxTypes = [];

	public get showTaxesInput(): boolean {
		return this._showTaxesInput;
	}
	public set showTaxesInput(value: boolean) {
		this._showTaxesInput = value;
	}

	constructor(
		public dialogRef: NbDialogRef<ExpensesMutationComponent>,
		private dialogService: NbDialogService,
		private fb: FormBuilder,
		private organizationVendorsService: OrganizationVendorsService,
		private store: Store,
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly expenseCategoriesStore: OrganizationExpenseCategoriesService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.getTranslatedTaxTypes();
		this._initializeForm();
		this.getDefaultData();
		this.loadOrganizationContacts();
		this.loadProjects();
		this.changeExpenseType(this.form.value.typeOfExpense);
	}

	get currency() {
		return this.form.get('currency');
	}

	private async getDefaultData() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		this.organizationId = organizationId;
		this.tenantId = tenantId;

		const { items: category } = await this.expenseCategoriesStore.getAll({
			organizationId,
			tenantId
		});
		this.expenseCategories = category;

		const { items: vendors } = await this.organizationVendorsService.getAll(
			{
				organizationId,
				tenantId
			}
		);
		this.vendors = vendors;
	}

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}
	selectProject($event) {
		this.project = $event;
	}

	async addOrEditExpense() {
		if (
			this.form.value.typeOfExpense ===
				ExpenseTypesEnum.BILLABLE_TO_CONTACT &&
			!this.form.value.organizationContact
		) {
			this.showWarning = true;
			setTimeout(() => {
				this.closeWarning();
			}, 3000);
			return;
		} else {
			this.closeWarning();
		}

		if (this.form.value.organizationContact === null) {
			this.form.value.organizationContact = {
				organizationContactName: null,
				organizationContactId: null
			};
		}

		if (this.form.value.project === null) {
			this.form.value.project = {
				projectName: null,
				projectId: null
			};
		}

		if (this.employeeSelector.selectedEmployee === ALL_EMPLOYEES_SELECTED)
			this.form.value.splitExpense = true;

		if (
			this.form.value.typeOfExpense !==
			ExpenseTypesEnum.BILLABLE_TO_CONTACT
		) {
			this.form.value.status = this.getTranslation(
				'EXPENSES_PAGE.MUTATION.NOT_BILLABLE'
			);
		}

		this.dialogRef.close(
			Object.assign(
				{ employee: this.employeeSelector.selectedEmployee },
				this.form.value
			)
		);
	}
	addNewCategory = async (
		name: string
	): Promise<IOrganizationExpenseCategory> => {
		try {
			this.toastrService.success('EXPENSES_PAGE.ADD_EXPENSE_CATEGORY', {
				name
			});
			return await this.expenseCategoriesStore.create({
				name,
				organizationId: this.organizationId,
				tenantId: this.tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	addNewVendor = (name: string): Promise<IOrganizationVendor> => {
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.ADD_VENDOR',
				{
					name
				}
			);
			return this.organizationVendorsService.create({
				name,
				organizationId: this.organizationId,
				tenantId: this.tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	addNewOrganizationContact = (
		name: string
	): Promise<IOrganizationContact> => {
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT',
				{
					name
				}
			);
			return this.organizationContactService.create({
				name,
				contactType: ContactType.CLIENT,
				organizationId: this.organizationId,
				tenantId: this.tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		this.organizationId = this.store.selectedOrganization.id;
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
				{
					name
				}
			);
			return this.organizationProjectsService.create({
				name,
				organizationId: this.organizationId,
				tenantId: this.tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	showNotesInput() {
		return (this.showNotes = !this.showNotes);
	}

	includeTaxes() {
		if (this.form.value.taxType) {
			this.disable = false;
		}
		this.calculateTaxes();
		return (this.showTaxesInput = !this.showTaxesInput);
	}

	private _initializeForm() {
		if (this.expense) {
			this.form = this.fb.group({
				id: [this.expense.id],
				amount: [this.expense.amount, Validators.required],
				vendor: [this.expense.vendor, Validators.required],
				typeOfExpense: this.expense.typeOfExpense,
				category: [this.expense.category, Validators.required],
				notes: [this.expense.notes],
				currency: [this.expense.currency],
				valueDate: [
					new Date(this.expense.valueDate),
					Validators.required
				],
				purpose: [this.expense.purpose],
				organizationContact: [this.expense.organizationContactName],
				project: [this.expense.projectName],
				taxType: [this.expense.taxType],
				taxLabel: [this.expense.taxLabel],
				rateValue: [this.expense.rateValue],
				receipt: [this.expense.receipt],
				splitExpense: [this.expense.splitExpense],
				tags: [this.expense.tags],
				status: [this.expense.status]
			});
			if (this.form.value.taxLabel) {
				this.includeTaxes();
			}
			if (this.form.value.notes) {
				this.showNotesInput();
			}
		} else {
			this.form = this.fb.group({
				amount: ['', Validators.required],
				vendor: [null, Validators.required],
				typeOfExpense: [this.expenseTypes[0]],
				category: [null, Validators.required],
				notes: [''],
				currency: [''],
				valueDate: [
					this.store.getDateFromOrganizationSettings(),
					Validators.required
				],
				purpose: [''],
				organizationContact: [null],
				project: [null],
				taxType: [TaxTypesEnum.PERCENTAGE],
				taxLabel: [''],
				rateValue: [0],
				receipt: [this.defaultImage],
				splitExpense: [false],
				tags: [],
				status: []
			});
			const { currency } = this.store.selectedOrganization;
			if (this.currency && !this.currency.value) {
				this.currency.setValue(currency);
				this.currency.updateValueAndValidity();
			}
		}

		this.valueDate = this.form.get('valueDate');
		this.amount = this.form.get('amount');
		this.notes = this.form.get('notes');
		this.tags = this.form.get('tags').value || [];
	}

	private calculateTaxes() {
		this.form.valueChanges.pipe(untilDestroyed(this)).subscribe((val) => {
			const amount = val.amount;
			const rate = val.rateValue;
			const oldNotes = val.notes;

			if (val.taxType === TaxTypesEnum.PERCENTAGE) {
				const result = (amount / (rate + 100)) * 100 * (rate / 100);

				this.calculatedValue =
					`${this.getTranslation(
						'EXPENSES_PAGE.MUTATION.TAX_AMOUNT'
					)}: ` +
					result.toFixed(2) +
					' ' +
					val.currency;
			} else {
				const result = (rate / (amount - rate)) * 100;
				this.calculatedValue =
					`${this.getTranslation(
						'EXPENSES_PAGE.MUTATION.TAX_RATE'
					)}: ` +
					result.toFixed(2) +
					' %';
			}

			if (rate !== 0) {
				val.notes = this.calculatedValue + '. ' + oldNotes;
			}
		});
	}

	private async loadOrganizationContacts() {
		const res = await this.organizationContactService.getAll(['projects'], {
			organizationId: this.organizationId,
			tenantId: this.tenantId
		});

		if (res) {
			res.items.forEach((organizationContact) => {
				this.organizationContacts.push({
					name: organizationContact.name,
					organizationContactId: organizationContact.id
				});
			});
		}
	}

	private async loadProjects() {
		const res = await this.organizationProjectsService.getAll(
			['organizationContact'],
			{
				organizationId: this.organizationId,
				tenantId: this.tenantId
			}
		);

		if (res) {
			res.items.forEach((project) => {
				this.projects.push({
					name: project.name,
					projectId: project.id
				});
			});
		}
	}

	closeWarning() {
		this.showWarning = !this.showWarning;
	}

	attachReceipt() {
		this.dialogService
			.open(AttachReceiptComponent, {
				context: {
					currentReceipt: this.form.value.receipt
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((newReceipt) => {
				this.form.value.receipt = newReceipt;
			});
	}

	selectedTagsHandler(currentSelection: ITag) {
		this.form.get('tags').setValue(currentSelection);
	}

	onEmployeeChange(selectedEmployee: SelectedEmployee) {
		this.showTooltip = selectedEmployee === ALL_EMPLOYEES_SELECTED;
	}

	changeExpenseType($event) {
		if ($event !== ExpenseTypesEnum.BILLABLE_TO_CONTACT) {
			this.disableStatuses = true;
		} else {
			this.disableStatuses = false;
		}
	}

	getTranslatedTaxTypes() {
		this.taxTypes.forEach((element) => {
			this.translatedTaxTypes.push({
				value: `${element}`,
				label: this.getTranslation(`EXPENSES_PAGE.MUTATION.${element}`)
			});
		});
	}

	close() {
		this.dialogRef.close();
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}

	ngOnDestroy() {
		clearTimeout();
	}
}
