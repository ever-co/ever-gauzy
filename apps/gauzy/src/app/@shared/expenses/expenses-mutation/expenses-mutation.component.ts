import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit, Input, ChangeDetectorRef } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import {
	FormBuilder,
	Validators,
	FormGroup,
	FormControl
} from '@angular/forms';
import {
	TaxTypesEnum,
	ExpenseTypesEnum,
	ITag,
	IOrganizationContact,
	IOrganizationProject,
	ISelectedEmployee,
	IOrganization,
	IExpense,
	ExpenseStatusesEnum,
	ICurrency
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import {
	EmployeeSelectorComponent,
	ALL_EMPLOYEES_SELECTED
} from '../../../@theme/components/header/selectors/employee';
import { AttachReceiptComponent } from './attach-receipt/attach-receipt.component';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { Store } from '../../../@core/services';
import { FormHelpers } from '../../forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expenses-mutation',
	templateUrl: './expenses-mutation.component.html',
	styleUrls: ['./expenses-mutation.component.scss']
})
export class ExpensesMutationComponent extends TranslationBaseComponent 
	implements AfterViewInit, OnInit, OnDestroy {

	FormHelpers: typeof FormHelpers = FormHelpers;

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;

	/*
	* Getter & Setter for expense
	*/
	_expense: IExpense;
	get expense(): IExpense {
		return this._expense;
	}
	@Input() set expense(expense: IExpense) {
		if (expense) {
			this._expense = expense;
			this._initializeForm();
		}
	}

	expenseTypes = Object.values(ExpenseTypesEnum);
	expenseTypesEnum = ExpenseTypesEnum;
	taxTypes = Object.values(TaxTypesEnum);
	public statuses: string[] = [];
	defaultImage = './assets/images/others/invoice-template.png';
	calculatedValue = '0';
	duplicate: boolean;
	showNotes: boolean = false;
	showWarning: boolean = false;
	showTooltip: boolean = false;
	showTaxesInput: boolean = false;
	
	public organization: IOrganization;
	/*
	* Expense Mutation Form 
	*/
	public form: FormGroup = ExpensesMutationComponent.buildForm(this.fb, this);
	static buildForm(
		fb: FormBuilder,
		self: ExpensesMutationComponent
	): FormGroup {
		return fb.group({
			amount: ['', Validators.required],
			vendor: [],
			typeOfExpense: [ExpenseTypesEnum.TAX_DEDUCTIBLE],
			category: [],
			notes: [],
			currency: ['', Validators.required],
			valueDate: [self.store.getDateFromOrganizationSettings(), Validators.required],
			purpose: [],
			organizationContact: [],
			projectId: [],
			project: [],
			taxType: [TaxTypesEnum.PERCENTAGE],
			taxLabel: [],
			rateValue: [0],
			receipt: [self.defaultImage],
			splitExpense: [false],
			tags: [],
			employee: [],
			status: []
		});
	}

	constructor(
		public readonly dialogRef: NbDialogRef<ExpensesMutationComponent>,
		private readonly dialogService: NbDialogService,
		private readonly fb: FormBuilder,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => {
					const typeOfExpense = <FormControl>this.form.get('typeOfExpense');
					this.setExpenseStatuses(typeOfExpense.value);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {}

	/**
	 * Added statuses dropdown selector
	 */
	setExpenseStatuses(typeOfExpense: ExpenseTypesEnum) {
		const statuses = Object.values(ExpenseStatusesEnum);
		if (typeOfExpense === ExpenseTypesEnum.BILLABLE_TO_CONTACT) {
			this.statuses = statuses.filter(
				(status: ExpenseStatusesEnum) => status != ExpenseStatusesEnum.NOT_BILLABLE
			);
		} else {
			this.statuses = statuses.filter(
				(status: ExpenseStatusesEnum) => status == ExpenseStatusesEnum.NOT_BILLABLE
			);
		}
	}

	/**
	 * Selected Organization Contact
	 * 
	 * @param contact 
	 */
	selectedOrganizationContact(contact: IOrganizationContact) {
		this.form.get('organizationContact').setValue(contact);
		this.form.get('organizationContact').updateValueAndValidity();
	}

	/**
	 * Selected Project
	 * 
	 * @param project 
	 */
	selectedProject(project: IOrganizationProject) {
		this.form.get('project').setValue(project);
		this.form.get('project').updateValueAndValidity();
	}

	/**
	 * Selected Tags Handler
	 * 
	 * @param tags 
	 */
	 selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	async addOrEditExpense() {
		const { typeOfExpense, organizationContact } = this.form.getRawValue();		
		if (typeOfExpense === ExpenseTypesEnum.BILLABLE_TO_CONTACT && !organizationContact) {
			this.showWarning = true;
			setTimeout(() => {
				this.closeWarning();
			}, 3000);
			return;
		} else {
			this.closeWarning();
		}

		if (this.form.invalid) {
			return;
		}
		this.dialogRef.close(Object.assign(this.form.getRawValue(), {
			splitExpense: this.showTooltip
		}));
	}

	showNotesInput() {
		return (this.showNotes = !this.showNotes);
	}

	includeTaxes() {
		this.calculateTaxes();
		return (this.showTaxesInput = !this.showTaxesInput);
	}

	private _initializeForm() {
		if (this.expense) {
			const { project, organizationContact } = this.expense;
			this.form.patchValue({
				amount: this.expense.amount,
				vendor: this.expense.vendor,
				typeOfExpense: this.expense.typeOfExpense,
				category: this.expense.category,
				notes: this.expense.notes,
				currency: this.expense.currency,
				valueDate: new Date(this.expense.valueDate),
				purpose: this.expense.purpose,
				organizationContact: organizationContact,
				organizationContactId: (organizationContact) ? organizationContact.id : null,
				project: project,
				projectId: (project) ? project.id : null,
				taxType: this.expense.taxType,
				taxLabel: this.expense.taxLabel,
				rateValue: this.expense.rateValue,
				receipt: this.expense.receipt,
				splitExpense: this.expense.splitExpense,
				tags: this.expense.tags,
				status: this.expense.status,
				employee: this.expense.employee
			});
			if (this.expense.taxLabel) {
				this.includeTaxes();
			}
			if (this.expense.notes) {
				this.showNotesInput();
			}
		}
	}

	private calculateTaxes() {
		this.form.valueChanges
			.pipe(untilDestroyed(this))
			.subscribe((val) => {
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
			.onClose
			.pipe(
				tap((receipt) => {
					this.form.get('receipt').setValue(receipt);
					this.form.get('receipt').updateValueAndValidity();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onEmployeeChange(employee: ISelectedEmployee) {
		if (employee) {
			this.form.patchValue({ employee: employee });
			this.form.updateValueAndValidity();
		}
		this.showTooltip = (
			isEmpty(this.employeeSelector) || 
			this.employeeSelector.selectedEmployee === ALL_EMPLOYEES_SELECTED
		);
	}

	close() {
		this.dialogRef.close();
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged(currency: ICurrency) {
		this.form.get('currency').setValue(currency.isoCode);
		this.form.get('currency').updateValueAndValidity();
	}

	ngOnDestroy() {
		clearTimeout();
	}
}
