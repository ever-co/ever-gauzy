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
	ITag,
	IOrganizationContact,
	IOrganizationProject,
	ExpenseStatusesEnum,
	ContactType,
	IExpenseViewModel,
	ICurrency,
	ISelectedEmployee,
	IOrganization
} from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common-angular';
import {
	EmployeeSelectorComponent,
	ALL_EMPLOYEES_SELECTED
} from '../../../@theme/components/header/selectors/employee';
import { AttachReceiptComponent } from './attach-receipt/attach-receipt.component';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { 
	ErrorHandlingService,
	OrganizationContactService,
	OrganizationProjectsService,
	Store,
	ToastrService 
} from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expenses-mutation',
	templateUrl: './expenses-mutation.component.html',
	styleUrls: ['./expenses-mutation.component.scss']
})
export class ExpensesMutationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;

	expense: IExpenseViewModel;
	organizationId: string;
	tenantId: string;
	typeOfExpense: string;
	expenseTypes = Object.values(ExpenseTypesEnum);
	taxTypes = Object.values(TaxTypesEnum);
	expenseStatuses = Object.values(ExpenseStatusesEnum);
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
	organization: IOrganization;
	selectedEmployee: ISelectedEmployee

	_showTaxesInput = false;
	public get showTaxesInput(): boolean {
		return this._showTaxesInput;
	}
	public set showTaxesInput(value: boolean) {
		this._showTaxesInput = value;
	}

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
			vendor: [null, Validators.required],
			typeOfExpense: [self.expenseTypes[0]],
			category: [null, Validators.required],
			notes: [''],
			currency: [''],
			valueDate: [ self.store.getDateFromOrganizationSettings(), Validators.required ],
			purpose: [''],
			organizationContact: [null],
			project: [null],
			taxType: [TaxTypesEnum.PERCENTAGE],
			taxLabel: [''],
			rateValue: [0],
			receipt: [self.defaultImage],
			splitExpense: [false],
			tags: [],
			status: []
		});
	}

	constructor(
		public readonly dialogRef: NbDialogRef<ExpensesMutationComponent>,
		private readonly dialogService: NbDialogService,
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => {
					this.tenantId = this.store.user.tenantId;
					this.organization = organization;
					this.organizationId = organization.id;
				}),
				tap(() => this.getOrganizationContacts()),
				tap(() => this.getProjects()),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.getTranslatedTaxTypes()
				this._initializeForm();
				this.changeExpenseType(this.form.value.typeOfExpense);
			});
	}

	get currency() {
		return this.form.get('currency');
	}

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}
	selectProject($event) {
		this.project = $event;
	}

	async addOrEditExpense() {
		const { typeOfExpense, organizationContact, project } = this.form.value;
		if (typeOfExpense === ExpenseTypesEnum.BILLABLE_TO_CONTACT && !organizationContact) {
			this.showWarning = true;
			setTimeout(() => {
				this.closeWarning();
			}, 3000);
			return;
		} else {
			this.closeWarning();
		}

		if (organizationContact === null) {
			this.form.patchValue({
				organizationContactName: null,
				organizationContactId: null
			});
		}

		if (project === null) {
			this.form.patchValue({
				projectName: null,
				projectId: null
			});
		}

		if ( typeOfExpense !== ExpenseTypesEnum.BILLABLE_TO_CONTACT) {
			this.form.patchValue({
				status: this.getTranslation('EXPENSES_PAGE.MUTATION.NOT_BILLABLE')
			});
		}

		this.dialogRef.close(
			Object.assign(
				{ employee: this.employeeSelector.selectedEmployee },
				this.form.value,
				{ splitExpense: this.showTooltip }
			)
		);
	}

	addNewOrganizationContact = (
		name: string
	): Promise<IOrganizationContact> => {
		try {
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT', {
				name
			});
			const { tenantId, organizationId } = this;
			return this.organizationContactService.create({
				name,
				contactType: ContactType.CLIENT,
				organizationId,
				tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		const { tenantId, organizationId } = this;
		try {
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', {
				name
			});
			return this.organizationProjectsService.create({
				name,
				organizationId,
				tenantId
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
			this.form.patchValue({
				id: this.expense.id,
				amount: this.expense.amount,
				vendor: this.expense.vendor,
				typeOfExpense: this.expense.typeOfExpense,
				category: this.expense.category,
				notes: this.expense.notes,
				currency: this.expense.currency,
				valueDate: new Date(this.expense.valueDate),
				purpose: this.expense.purpose,
				organizationContact: this.expense.organizationContactName,
				project: this.expense.project,
				taxType: this.expense.taxType,
				taxLabel: this.expense.taxLabel,
				rateValue: this.expense.rateValue,
				receipt: this.expense.receipt,
				splitExpense: this.expense.splitExpense,
				tags: this.expense.tags,
				status: this.expense.status
			});
			if (this.expense.taxLabel) {
				this.includeTaxes();
			}
			if (this.expense.notes) {
				this.showNotesInput();
			}
		} else {
			const { currency } = this.organization;
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

	private async getOrganizationContacts() {
		const { tenantId, organizationId } = this;
		const { items = [] } = await this.organizationContactService.getAll(['projects'], {
			organizationId,
			tenantId
		});
		this.organizationContacts = items.map((organizationContact) => {
			return {
				name: organizationContact.name,
				organizationContactId: organizationContact.id
			}
		});
	}

	private async getProjects() {
		const { tenantId, organizationId } = this;
		const { items = [] } = await this.organizationProjectsService.getAll(['organizationContact'], {
			organizationId,
			tenantId
		});
		this.projects = items.map((project) => {
			return {
				name: project.name,
				projectId: project.id
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
				tap((newReceipt) => {
					this.form.patchValue({
						receipt: newReceipt
					})
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectedTagsHandler(currentSelection: ITag) {
		this.form.patchValue({
			tags: currentSelection
		});
	}

	onEmployeeChange(selectedEmployee: ISelectedEmployee) {
		this.selectedEmployee = selectedEmployee;
		this.showTooltip = (
			isEmpty(this.employeeSelector) || 
			this.employeeSelector.selectedEmployee === ALL_EMPLOYEES_SELECTED
		);
	}

	changeExpenseType($event) {
		this.disableStatuses = $event !== ExpenseTypesEnum.BILLABLE_TO_CONTACT;
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

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return (
			(this.form.get(control).touched || this.form.get(control).dirty)
			 && this.form.get(control).invalid
		);
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}

	ngOnDestroy() {
		clearTimeout();
	}
}
