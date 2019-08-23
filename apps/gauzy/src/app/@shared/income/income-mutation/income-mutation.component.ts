import { Component, OnInit } from '@angular/core';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { Income, OrganizationSelectInput } from '@gauzy/models';
import { CurrenciesEnum } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';

@Component({
    selector: 'ngx-income-mutation',
    templateUrl: './income-mutation.component.html',
    styleUrls: ['./income-mutation.component.scss']
})
export class IncomeMutationComponent implements OnInit {
    income?: Income;
    currencies = Object.values(CurrenciesEnum);

    form: FormGroup;

    fakeClients = [
        {
            clientName: 'CUEAudio',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Urwex',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Nabo',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Gauzy',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Everbie',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            clientName: 'Random Client',
            clientId: (Math.floor(Math.random() * 101) + 1).toString()
        }
    ];

    get valueDate() {
        return this.form.get('valueDate').value;
    }

    set valueDate(value) {
        this.form.get('valueDate').setValue(value);
    }

    get amount() {
        return this.form.get('amount').value;
    }

    set amount(value) {
        this.form.get('amount').setValue(value);
    }

    get currency() {
        return this.form.get('currency');
    }

    get clientName() {
        return this.form.get('client').value.clientName;
    }

    get clientId() {
        return this.form.get('client').value.clientId;
    }

    constructor(private fb: FormBuilder,
        protected dialogRef: NbDialogRef<IncomeMutationComponent>,
        private organizationsService: OrganizationsService,
        private store: Store
    ) {
    }

    ngOnInit() {
        this._initializeForm();
    }

    addOrEditExpense() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }

    close() {
        this.dialogRef.close();
    }

    private _initializeForm() {
        if (this.income) {
            this.form = this.fb.group({
                valueDate: [new Date(this.income.valueDate), Validators.required],
                amount: [this.income.amount, Validators.required],
                client: [{
                    clientId: this.income.clientId,
                    clientName: this.income.clientName
                }, Validators.required],
                notes: this.income.notes,
                currency: this.income.currency
            });
        } else {
            this.form = this.fb.group({
                valueDate: [new Date(), Validators.required],
                amount: ['', Validators.required],
                client: [null, Validators.required],
                notes: '',
                currency: ''
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
