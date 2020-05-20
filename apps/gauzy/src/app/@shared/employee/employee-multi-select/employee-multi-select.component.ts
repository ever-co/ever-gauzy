import {
	Component,
	EventEmitter,
	Input,
	Output,
	OnInit,
	forwardRef
} from '@angular/core';
import { Employee, Organization } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services/employees.service';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ga-employee-multi-select',
	templateUrl: './employee-multi-select.component.html',
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
	@Input() allEmployees: Employee[];
	@Input() multiple = true;
	@Input() disabled = false;
	@Input()
	public get selectedEmployeeIds(): string[] | string {
		return this.employeeId;
	}
	public set selectedEmployeeIds(value: string[] | string) {
		this.employeeId = value;
	}

	organization: Organization;
	val: string[] | string;
	onChange: any = () => {};
	onTouched: any = () => {};

	constructor(
		private employeesService: EmployeesService,
		private store: Store
	) {}

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

	ngOnInit(): void {
		this.organization = this.store.selectedOrganization;
		if (!this.allEmployees) {
			this.loadEmployees();
		}
	}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}

	private async loadEmployees(): Promise<void> {
		const { items = [] } = await this.employeesService
			.getAll(['user'], {
				orgId: this.organization.id
			})
			.toPromise();
		this.allEmployees = items;
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
