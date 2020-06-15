import {
	Component,
	EventEmitter,
	Input,
	Output,
	OnInit,
	forwardRef
} from '@angular/core';
import { Employee } from '@gauzy/models';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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

	employees: Employee[];
	private _allEmployees: Employee[];
	@Input()
	public get allEmployees(): Employee[] {
		return this._allEmployees;
	}
	public set allEmployees(value: Employee[]) {
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
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		this.val = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get employeeId(): string[] | string {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
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
