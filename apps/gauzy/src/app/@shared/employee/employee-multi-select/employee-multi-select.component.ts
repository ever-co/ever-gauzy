import {
	Component,
	EventEmitter,
	Input,
	Output,
	OnInit,
	forwardRef
} from '@angular/core';
import { IEmployee } from '@gauzy/models';
import { NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';

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
export class EmployeeSelectComponent implements OnInit {
	@Output() selectedChange = new EventEmitter();

	@Input() multiple = true;
	@Input() label = 'FORM.PLACEHOLDERS.ADD_REMOVE_EMPLOYEES';
	@Input() disabled = false;
	@Input() placeholder = 'FORM.PLACEHOLDERS.ADD_REMOVE_EMPLOYEES';
	select: FormControl = new FormControl();
	@Input()
	public set reset(value: boolean | null) {
		if (value) {
			if (this.multiple) {
				this.select.setValue([]);
			} else {
				this.select.reset();
			}
		}
	}

	employees: IEmployee[];
	private _allEmployees: IEmployee[];
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
		return this.employeeId;
	}
	public set selectedEmployeeIds(value: string[] | string) {
		this.employeeId = value;
	}
	val: string[] | string = null;
	onChange: any = () => {};
	onTouched: any = () => {};

	constructor() {}

	set employeeId(val: string[] | string) {
		setTimeout(() => {
			if (this.multiple) {
				this.val = val instanceof Array ? val : [val];
			} else {
				this.val = val instanceof Array ? val[0] : val;
			}
			this.onChange(val);
		});
	}
	get employeeId(): string[] | string {
		return this.val;
	}

	ngOnInit(): void {}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}

	writeValue(value: any) {
		this.employeeId = value;
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
}
