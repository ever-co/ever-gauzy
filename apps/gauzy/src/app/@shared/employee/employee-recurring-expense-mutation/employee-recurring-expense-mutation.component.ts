import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { CurrenciesEnum, OrganizationSelectInput, EmployeeRecurringExpense } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';

@Component({
    selector: 'ngx-employee-recurring-expense-mutation',
    templateUrl: './employee-recurring-expense-mutation.component.html',
    styleUrls: ['./employee-recurring-expense-mutation.component.scss']
})
export class EmployeeRecurringExpenseMutationComponent implements OnInit {
    public form: FormGroup;
    categoryNames = ['Salary', 'Salary Taxes', 'Extra Bonus'];
    employeeRecurringExpense?: EmployeeRecurringExpense;
    currencies = Object.values(CurrenciesEnum);

    constructor(private fb: FormBuilder,
        protected dialogRef: NbDialogRef<EmployeeRecurringExpenseMutationComponent>,
        private organizationsService: OrganizationsService,
        private store: Store
    ) { }

    get currency() {
        return this.form.get('currency');
    }

    ngOnInit() {
        this.employeeRecurringExpense ? this._initializeForm(this.employeeRecurringExpense) : this._initializeForm();
    }

    submitForm() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }

    private _initializeForm(employeeRecurringExpense?: EmployeeRecurringExpense) {
        this.form = this.fb.group({
            categoryName: [employeeRecurringExpense ? employeeRecurringExpense.categoryName : '', Validators.required],
            value: [employeeRecurringExpense ? employeeRecurringExpense.value : '', Validators.required],
            currency: [employeeRecurringExpense ? employeeRecurringExpense.currency : '', Validators.required]
        });

        this._loadDefaultCurrency();
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
