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
import {
	Employee,
	KeyResult,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum
} from '@gauzy/models';

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
	keyResultTypeEnum = KeyResultTypeEnum;
	keyResultDeadlineEnum = KeyResultDeadlineEnum;
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
			type: [this.keyResultTypeEnum.NUMBER, Validators.required],
			targetValue: [1],
			initialValue: [0],
			owner: [null, Validators.required],
			lead: [null],
			deadline: [
				this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE,
				Validators.required
			],
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
					: null,
				lead: this.data.lead.id,
				owner: this.data.owner.id
			});
		}
	}

	deadlineValidators() {
		if (
			this.keyResultsForm.get('deadline').value ===
			this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE
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
			this.keyResultsForm.get('deadline').value ===
			this.keyResultDeadlineEnum.HARD_DEADLINE
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
			this.keyResultDeadlineEnum.HARD_AND_SOFT_DEADLINE
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
					this.keyResultsForm.value.type ===
					this.keyResultTypeEnum.TRUE_OR_FALSE
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
