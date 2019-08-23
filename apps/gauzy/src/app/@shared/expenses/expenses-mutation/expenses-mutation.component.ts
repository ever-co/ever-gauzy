import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ExpenseViewModel } from '../../../pages/expenses/expenses.component';
import { CurrenciesEnum, OrganizationSelectInput } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';

@Component({
    selector: 'ga-expenses-mutation',
    templateUrl: './expenses-mutation.component.html',
    styleUrls: ['./expenses-mutation.component.scss']
})
export class ExpensesMutationComponent implements OnInit {
    form: FormGroup;

    expense: ExpenseViewModel;
    currencies = Object.values(CurrenciesEnum);

    fakeVendors = [
        {
            vendorName: 'Microsoft',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'Google',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'CaffeeMania',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'CoShare',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'Cleaning Company',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'Udemy',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'MultiSport',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        }
    ];

    fakeCategories = [
        {
            categoryName: 'Rent',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Electricity',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Internet',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Water Supply',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Office Supplies',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Parking',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Employees Benefits',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Insurance Premiums',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Courses',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Subscriptions',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Repairs',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Depreciable Assets',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Software Products',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Office Hardware',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Courier Services',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Business Trips',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Team Buildings',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        }
    ];

    constructor(
        protected dialogRef: NbDialogRef<ExpensesMutationComponent>,
        private fb: FormBuilder,
        private organizationsService: OrganizationsService,
        private store: Store) { }

    get currency() {
        return this.form.get('currency');
    }

    ngOnInit() {
        this._initializeForm();
        // TODO: here we'll get all the categories and vendors for ng-select menus
    }

    addOrEditExpense() {
        this.dialogRef.close(this.form.value);
    }

    private _initializeForm() {
        if (this.expense) {
            this.form = this.fb.group({
                id: [this.expense.id],
                amount: [this.expense.amount, Validators.required],
                vendor: [{
                    vendorId: this.expense.vendorId,
                    vendorName: this.expense.vendorName
                }, Validators.required],
                category: [{
                    categoryId: this.expense.categoryId,
                    categoryName: this.expense.categoryName
                }, Validators.required],
                notes: [this.expense.notes],
                currency: [this.expense.currency],
                valueDate: [new Date(this.expense.valueDate), Validators.required]
            });
        } else {
            this.form = this.fb.group({
                amount: ['', Validators.required],
                vendor: [null, Validators.required],
                category: [null, Validators.required],
                notes: [''],
                currency: [''],
                valueDate: [new Date(), Validators.required]
            });

            this._loadDefaultCurrency();
        }
    }

    private async _loadDefaultCurrency() {
        const orgData = await this.organizationsService
            .getById(
                this.store.selectedOrganization.id,
                [OrganizationSelectInput.currency]
            ).pipe(first()).toPromise();

        if (orgData && this.currency && !this.currency.value) {
            this.currency.setValue(orgData.currency);
        }
    }
}
