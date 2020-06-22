import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import {
	FormGroup,
	FormBuilder,
	Validators,
	FormControl
} from '@angular/forms';
import { EmployeesService } from '../../../@core/services';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Employee, KeyResult } from '@gauzy/models';

@Component({
	selector: 'ga-edit-keyresults',
	templateUrl: './edit-keyresults.component.html',
	styleUrls: ['./edit-keyresults.component.scss']
})
export class EditKeyResultsComponent implements OnInit, OnDestroy {
	employees: Employee[];
	keyResultsForm: FormGroup;
	data: KeyResult;
	showAllEmployees = false;
	softDeadline: FormControl;
	minDate = new Date();
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogRef: NbDialogRef<EditKeyResultsComponent>,
		public fb: FormBuilder,
		private employeeService: EmployeesService
	) {}

	ngOnInit() {
		this.minDate = new Date(
			this.minDate.setDate(this.minDate.getDate() + 1)
		);
		this.keyResultsForm = this.fb.group({
			name: ['', Validators.required],
			description: [''],
			type: ['Number', Validators.required],
			targetValue: [1],
			initialValue: [0],
			owner: ['', Validators.required],
			lead: [''],
			deadline: ['No Custom Deadline', Validators.required],
			softDeadline: [null],
			hardDeadline: [null]
		});

		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
		if (!!this.data) {
			this.keyResultsForm.patchValue(this.data);
			this.keyResultsForm.patchValue({
				softDeadline: this.data.softDeadline
					? new Date(this.data.softDeadline)
					: null,
				hardDeadline: this.data.hardDeadline
					? new Date(this.data.hardDeadline)
					: null
			});
		}
	}

	deadlineValidators() {
		if (
			this.keyResultsForm.get('deadline').value === 'No Custom Deadline'
		) {
			this.keyResultsForm.controls['softDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ softDeadline: undefined });
			this.keyResultsForm.controls[
				'softDeadline'
			].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ hardDeadline: undefined });
			this.keyResultsForm.controls[
				'hardDeadline'
			].updateValueAndValidity();
		} else if (
			this.keyResultsForm.get('deadline').value === 'Hard deadline'
		) {
			this.keyResultsForm.controls['softDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ softDeadline: undefined });
			this.keyResultsForm.controls[
				'softDeadline'
			].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].setValidators([
				Validators.required
			]);
			this.keyResultsForm.controls[
				'hardDeadline'
			].updateValueAndValidity();
		} else if (
			this.keyResultsForm.get('deadline').value ===
			'Hard and soft deadline'
		) {
			this.keyResultsForm.controls['softDeadline'].setValidators([
				Validators.required
			]);
			this.keyResultsForm.controls[
				'softDeadline'
			].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].setValidators([
				Validators.required
			]);
			this.keyResultsForm.controls[
				'hardDeadline'
			].updateValueAndValidity();
		}
	}

	selectEmployee(event, control) {
		if (control === 'lead') {
			this.keyResultsForm.patchValue({ lead: event });
		} else {
			this.keyResultsForm.patchValue({ owner: event });
		}
	}

	saveKeyResult() {
		if (!!this.data) {
			this.keyResultsForm.patchValue({
				targetValue:
					this.keyResultsForm.value.type === 'True/False'
						? 1
						: this.keyResultsForm.value.targetValue
			});
			this.closeDialog({
				...this.keyResultsForm.value,
				update: this.data.update
					? this.data.update
					: this.keyResultsForm.value.initialValue,
				status: this.data.status ? this.data.status : 'none',
				progress: this.data.progress ? this.data.progress : 0
			});
		} else {
			this.closeDialog({
				...this.keyResultsForm.value,
				update: this.keyResultsForm.value.initialValue,
				status: 'none',
				progress: 0
			});
		}
	}

	closeDialog(data = null) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
