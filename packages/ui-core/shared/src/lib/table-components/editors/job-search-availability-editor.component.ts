import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IEmployee } from '@gauzy/contracts';
import { JobService, ToastrService } from '@gauzy/ui-core/core';
import { Cell, DefaultEditor } from 'angular2-smart-table';
import { BehaviorSubject, Observable } from 'rxjs';

@Component({
	template: `<div>
		<nb-toggle
			[checked]="checked$ | async"
			(checkedChange)="onCheckedChange($event)"
			triggerParentClick
		></nb-toggle>
	</div>`
})
export class JobSearchAvailabilityEditorComponent extends DefaultEditor implements OnInit {
	private _checked$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	@Input() cell!: Cell;
	@Output() toggleChange: EventEmitter<boolean> = new EventEmitter();

	constructor(private readonly _jobService: JobService, private readonly _toastrService: ToastrService) {
		super();
	}

	public get checked$(): Observable<boolean> {
		return this._checked$.asObservable();
	}

	ngOnInit() {
		if (this.cell) {
			const employee: IEmployee = this.cell.getRow()?.getData();
			if (employee) {
				this.value = employee.isJobSearchActive; // Initialize the toggle value
			}
		}
	}

	@Input() public set value(checked: boolean) {
		this._checked$.next(checked);
	}

	onCheckedChange(isChecked: boolean) {
		this.toggleChange.emit(isChecked); // Emit the toggle change event
		this._checked$.next(isChecked);
		this.updateJobSearchAvailability(isChecked); // Update job search availability
	}

	async updateJobSearchAvailability(isJobSearchActive: boolean): Promise<void> {
		if (!this.cell) return; // Ensure 'cell' is available
		const employee: IEmployee = this.cell.getRow()?.getData();
		if (!employee) return; // Ensure employee data is available

		try {
			await this._jobService.updateJobSearchStatus(employee.id, {
				isJobSearchActive,
				organizationId: employee.organizationId,
				tenantId: employee.tenantId
			});

			const toastrMessageKey = isJobSearchActive
				? 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_ACTIVE'
				: 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_INACTIVE';

			this._toastrService.success(toastrMessageKey, { name: employee.fullName });
		} catch (error) {
			const errorMessage = error?.message || 'An error occurred while updating the job search availability.';
			this._toastrService.danger(errorMessage);
		}
	}
}
