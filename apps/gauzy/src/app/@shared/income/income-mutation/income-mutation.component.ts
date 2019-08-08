import { Component, OnInit } from '@angular/core';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { Income } from '@gauzy/models';

@Component({
    selector: 'ngx-income-mutation',
    templateUrl: './income-mutation.component.html',
    styleUrls: ['./income-mutation.component.scss']
})
export class IncomeMutationComponent implements OnInit {
    income?: Income;

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

    get clientName() {
        return this.form.get('client').value.clientName;
    }

    get clientId() {
        return this.form.get('client').value.clientId;
    }

    constructor(private fb: FormBuilder,
        protected dialogRef: NbDialogRef<IncomeMutationComponent>) {

    }

    ngOnInit() {
        this._initializeForm();
    }

    addOrEditExpense() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
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
                notes: this.income.notes
            });
        } else {
            this.form = this.fb.group({
                valueDate: [new Date(), Validators.required],
                amount: ['', Validators.required],
                client: [null, Validators.required],
                notes: ''
            });
        }
    }
}
