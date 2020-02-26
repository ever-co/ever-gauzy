import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ExpenseViewModel } from '../../../pages/expenses/expenses.component';
import {
	CurrenciesEnum,
	OrganizationSelectInput,
	TaxTypesEnum,
	ExpenseTypesEnum
} from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { OrganizationVendorsService } from '../../../@core/services/organization-vendors.service';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { AttachReceiptComponent } from './attach-receipt/attach-receipt.component';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-expenses-mutation',
	templateUrl: './expenses-mutation.component.html',
	styleUrls: ['./expenses-mutation.component.scss']
})
export class ExpensesMutationComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;
	form: FormGroup;
	expense: ExpenseViewModel;
	organizationId: string;
	typeOfExpense: string;
	expenseTypes = Object.values(ExpenseTypesEnum);
	currencies = Object.values(CurrenciesEnum);
	taxTypes = Object.values(TaxTypesEnum);
	fakeCategories: { categoryName: string; categoryId: string }[] = [];
	vendors: { vendorName: string; vendorId: string }[] = [];
	clients: { clientName: string; clientId: string }[] = [];
	projects: { projectName: string; projectId: string }[] = [];
	defaultImage = './assets/images/others/invoice-template.png';
	calculatedValue = '0';
	duplicate: boolean;
	showNotes = false;
	showTaxesInput = false;
	showWarning = false;
	disable = true;

	constructor(
		public dialogRef: NbDialogRef<ExpensesMutationComponent>,
		private dialogService: NbDialogService,
		private fb: FormBuilder,
		private organizationsService: OrganizationsService,
		private organizationVendorsService: OrganizationVendorsService,
		private store: Store,
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly organizationProjectsService: OrganizationProjectsService
	) {}

	ngOnInit() {
		this.getDefaultData();
		this.loadClients();
		this.loadProjects();
		this._initializeForm();
		this.form.get('currency').disable();
	}

	get currency() {
		return this.form.get('currency');
	}

	private getFakeId = () => (Math.floor(Math.random() * 101) + 1).toString();

	private async getDefaultData() {
		this.organizationId = this.store.selectedOrganization.id;
		const res = await this.organizationVendorsService.getAll({
			organizationId: this.organizationId
		});

		if (res) {
			const resultArr = res.items;
			resultArr.forEach((vendor) => {
				this.vendors.push({
					vendorName: vendor.name,
					vendorId: vendor.id
				});
			});
		}

		if (!this.vendors.length) {
			const fakeVendorNames = [
				'Microsoft',
				'Google',
				'CaffeeMania',
				'CoShare',
				'Cleaning Company',
				'Udemy',
				'MultiSport'
			];

			fakeVendorNames.forEach((name) => {
				this.vendors.push({
					vendorName: name,
					vendorId: this.getFakeId()
				});
			});
		}

		const fakeCategoryNames = [
			'Rent',
			'Electricity',
			'Internet',
			'Water Supply',
			'Office Supplies',
			'Parking',
			'Employees Benefits',
			'Insurance Premiums',
			'Courses',
			'Subscriptions',
			'Repairs',
			'Depreciable Assets',
			'Software Products',
			'Office Hardware',
			'Courier Services',
			'Business Trips',
			'Team Buildings'
		];

		fakeCategoryNames.forEach((name) => {
			this.fakeCategories.push({
				categoryName: name,
				categoryId: this.getFakeId()
			});
		});
	}

	addOrEditExpense() {
		if (
			this.form.value.typeOfExpense === 'Billable to Client' &&
			!this.form.value.client
		) {
			this.showWarning = true;
			setTimeout(() => {
				this.closeWarning();
			}, 3000);
			return;
		} else {
			this.closeWarning();
		}

		if (this.form.value.client === null) {
			this.form.value.client = {
				clientName: null,
				clientId: null
			};
		}

		if (this.form.value.project === null) {
			this.form.value.project = {
				projectName: null,
				projectId: null
			};
		}

		this.dialogRef.close(
			Object.assign(
				{ employee: this.employeeSelector.selectedEmployee },
				this.form.value
			)
		);
	}

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
				vendor: [
					{
						vendorId: this.expense.vendorId,
						vendorName: this.expense.vendorName
					},
					Validators.required
				],
				typeOfExpense: this.expense.typeOfExpense,
				category: [
					{
						categoryId: this.expense.categoryId,
						categoryName: this.expense.categoryName
					},
					Validators.required
				],
				notes: [this.expense.notes],
				currency: [this.expense.currency],
				valueDate: [
					new Date(this.expense.valueDate),
					Validators.required
				],
				purpose: [this.expense.purpose],
				client: [null],
				project: [null],
				taxType: [this.expense.taxType],
				taxLabel: [this.expense.taxLabel],
				rateValue: [this.expense.rateValue],
				receipt: [this.expense.receipt]
			});
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
				client: [null],
				project: [null],
				taxType: [TaxTypesEnum.PERCENTAGE],
				taxLabel: [''],
				rateValue: [0],
				receipt: [this.defaultImage]
			});

			this._loadDefaultCurrency();
		}
	}

	private calculateTaxes() {
		this.form.valueChanges
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((val) => {
				const amount = val.amount;
				const rate = val.rateValue;
				const oldNotes = val.notes;

				if (val.taxType === 'Percentage') {
					const result = (amount / (rate + 100)) * 100 * (rate / 100);

					this.calculatedValue =
						'Tax Amount: ' + result.toFixed(2) + ' ' + val.currency;
				} else {
					const result = (rate / (amount - rate)) * 100;
					this.calculatedValue =
						'Tax Rate: ' + result.toFixed(2) + ' %';
				}

				if (rate !== 0) {
					val.notes = this.calculatedValue + '. ' + oldNotes;
				}
			});
	}

	private async loadClients() {
		const res = await this.organizationClientsService.getAll(['projects'], {
			organizationId: this.organizationId
		});

		if (res) {
			res.items.forEach((client) => {
				this.clients.push({
					clientName: client.name,
					clientId: client.id
				});
			});
		}
	}

	private async loadProjects() {
		const res = await this.organizationProjectsService.getAll(['client'], {
			organizationId: this.organizationId
		});

		if (res) {
			res.items.forEach((project) => {
				this.projects.push({
					projectName: project.name,
					projectId: project.id
				});
			});
		}
	}

	private async _loadDefaultCurrency() {
		const orgData = await this.organizationsService
			.getById(this.store.selectedOrganization.id, [
				OrganizationSelectInput.currency
			])
			.pipe(first())
			.toPromise();

		if (orgData && this.currency && !this.currency.value) {
			this.currency.setValue(orgData.currency);
		}
	}

	private closeWarning() {
		this.showWarning = !this.showWarning;
	}

	private attachReceipt() {
		this.dialogService
			.open(AttachReceiptComponent, {
				context: {
					currentReceipt: this.form.value.receipt
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe((newReceipt) => {
				this.form.value.receipt = newReceipt;
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
		clearTimeout();
	}
}
