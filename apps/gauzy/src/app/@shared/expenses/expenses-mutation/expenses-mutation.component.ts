import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ExpenseViewModel } from '../../../pages/expenses/expenses.component';
import { CurrenciesEnum, OrganizationSelectInput } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { OrganizationVendorsService } from '../../../@core/services/organization-vendors.service';

@Component({
	selector: 'ga-expenses-mutation',
	templateUrl: './expenses-mutation.component.html',
	styleUrls: ['./expenses-mutation.component.scss']
})
export class ExpensesMutationComponent implements OnInit {
	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;
	form: FormGroup;
	expense: ExpenseViewModel;
	fakeCategories: { categoryName: string; categoryId: string }[] = [];
	currencies = Object.values(CurrenciesEnum);
	vendor: { vendorName: string; vendorId: string };
	vendors: { vendorName: string; vendorId: string }[] = [];
	showNotes = false;

	constructor(
		public dialogRef: NbDialogRef<ExpensesMutationComponent>,
		private fb: FormBuilder,
		private organizationsService: OrganizationsService,
		private organizationVendorsService: OrganizationVendorsService,
		private store: Store
	) {}

	ngOnInit() {
		this.getData();
		this._initializeForm();

		// TODO: here we'll get all the categories and vendors for ng-select menus
	}

	get currency() {
		return this.form.get('currency');
	}

	private getFakeId = () => (Math.floor(Math.random() * 101) + 1).toString();

	private async getData() {
		const res = await this.organizationVendorsService.getAll({
			organizationId: this.store.selectedOrganization.id
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
				purpose: [this.expense.purpose]
			});
		} else {
			this.form = this.fb.group({
				amount: ['', Validators.required],
				vendor: [null, Validators.required],
				category: [null, Validators.required],
				notes: [''],
				currency: [''],
				valueDate: [
					this.store.getDateFromOrganizationSettings(),
					Validators.required
				],
				purpose: ['']
			});

			this._loadDefaultCurrency();
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
}
