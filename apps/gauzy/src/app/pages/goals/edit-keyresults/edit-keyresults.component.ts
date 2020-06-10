import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { EmployeesService } from '../../../@core/services';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Employee } from '@gauzy/models';

@Component({
	selector: 'ga-edit-keyresults',
	templateUrl: './edit-keyresults.component.html',
	styleUrls: ['./edit-keyresults.component.scss']
})
export class EditKeyresultsComponent implements OnInit, OnDestroy {
	employees: Employee[];
	keyResultsForm: FormGroup;
	showAllEmployees = false;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogRef: NbDialogRef<EditKeyresultsComponent>,
		public fb: FormBuilder,
		private employeeService: EmployeesService
	) {}

	ngOnInit() {
		this.keyResultsForm = this.fb.group({
			name: ['', Validators.required],
			description: [''],
			owner: ['', Validators.required],
			lead: [''],
			deadline: ['no-custom-deadline', Validators.required],
			softDeadline: [new Date()],
			hardDeadline: [new Date()]
		});
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
	}

	test(event, control) {
		if (control == 'lead') {
			this.keyResultsForm.patchValue({ lead: event });
		} else {
			this.keyResultsForm.patchValue({ owner: event });
		}
		console.log(this.keyResultsForm);
	}

	saveKeyResult() {
		this.closeDialog(this.keyResultsForm);
	}

	closeDialog(data = null) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
