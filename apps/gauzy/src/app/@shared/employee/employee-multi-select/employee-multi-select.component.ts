import {
	Component,
	EventEmitter,
	Input,
	Output,
	OnInit,
	forwardRef,
	OnDestroy
} from '@angular/core';
import { IEmployee, IOrganization } from '@gauzy/models';
import { NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-multi-select',
	templateUrl: './employee-multi-select.component.html',
	styleUrls: ['./employee-multi-select.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => EmployeeSelectComponent),
			multi: true
		}
	]
})
export class EmployeeSelectComponent implements OnInit, OnDestroy {
	organization: any;
	preSelected: string[] | string;
	@Input()
	public set reset(value: boolean | null) {
		if (value) {
			if (this.multiple) {
				this.select.setValue([]);
				this.select.updateValueAndValidity();
			} else {
				this.select.reset();
			}
		}
	}
	@Input()
	public get allEmployees(): IEmployee[] {
		return this._allEmployees;
	}
	public set allEmployees(value: IEmployee[]) {
		this._allEmployees = value;
		this.employees = this._allEmployees;
	}

	@Input()
	public get selectedEmployeeIds(): string[] | string {
		return this.val;
	}
	public set selectedEmployeeIds(value: string[] | string) {
		this.preSelected = value;
		this.select.setValue(value);
		this.select.updateValueAndValidity();
	}

	constructor(
		private employeesService: EmployeesService,
		private store: Store
	) {}

	set employeeId(value: string[] | string) {
		this.changeValue$.next(value);
	}
	get employeeId(): string[] | string {
		return this.val;
	}
	@Output() selectedChange = new EventEmitter();

	@Input() multiple = true;
	@Input() label = 'FORM.PLACEHOLDERS.ADD_REMOVE_EMPLOYEES';
	@Input() disabled = false;
	@Input() placeholder = 'FORM.PLACEHOLDERS.ADD_REMOVE_EMPLOYEES';
	select: FormControl = new FormControl();

	employees: IEmployee[];
	private _allEmployees: IEmployee[];
	val: string[] | string = null;
	changeValue$ = new Subject<string | string[]>();
	onChange: any = () => {};
	onTouched: any = () => {};

	ngOnInit(): void {
		this.changeValue$
			.pipe(untilDestroyed(this), debounceTime(100))
			.subscribe((value) => {
				this.checkForMultiSelectValue(value);
				this.onChange(this.val);
			});
		this.select.valueChanges
			.pipe(untilDestroyed(this))
			.subscribe((value) => {
				this.employeeId = value;
			});
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					if (!this.allEmployees || this.allEmployees.length === 0) {
						this.loadEmployees();
					}
				}
			});
	}

	checkForMultiSelectValue(val): void {
		if (this.multiple) {
			this.val = val instanceof Array ? val : [val];
		} else {
			this.val = val instanceof Array ? val[0] : val;
		}
	}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}

	writeValue(value: any) {
		this.changeValue$.next(value);
	}
	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	private async loadEmployees(): Promise<void> {
		const { items = [] } = await this.employeesService.getWorking(
			this.organization.id,
			this.organization.tenantId,
			new Date(),
			true
		);
		this.employees = items;
	}

	ngOnDestroy(): void {}
}
