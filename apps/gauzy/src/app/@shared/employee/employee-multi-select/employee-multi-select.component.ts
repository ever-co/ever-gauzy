import {
	Component,
	EventEmitter,
	Input,
	Output,
	OnInit,
	forwardRef,
	OnDestroy
} from '@angular/core';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import { filter, Subject, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from 'rxjs/operators';
import { EmployeesService, Store } from '../../../@core/services';

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
	loaded: boolean;
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

	/**
	 * Getter & Setter for employees
	 */
	private _employees: IEmployee[] = [];
	set employees(employees: IEmployee[]) {
		this._employees = employees;
		this.onLoadEmployees.emit(employees);
	}
	get employees(): IEmployee[] {
		return this._employees;
	}

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store
	) {}

	set employeeId(value: string[] | string) {
		this.changeValue$.next(value);
	}
	get employeeId(): string[] | string {
		return this.val;
	}

	@Output() selectedChange = new EventEmitter();
	@Output() onLoadEmployees = new EventEmitter();

	@Input() multiple = true;
	@Input() label = 'FORM.PLACEHOLDERS.ADD_REMOVE_EMPLOYEES';
	@Input() disabled = false;
	@Input() placeholder = 'FORM.PLACEHOLDERS.ADD_REMOVE_EMPLOYEES';
	select: FormControl = new FormControl();

	private _allEmployees: IEmployee[];
	val: string[] | string = null;
	changeValue$ = new Subject<string | string[]>();
	onChange: any = () => {};
	onTouched: any = () => {};

	ngOnInit(): void {
		//delay to pre selected employee
		this.loaded = false;
		setTimeout(() => {
			this.loaded = true;
		}, 500);

		this.changeValue$
			.pipe(
				debounceTime(100),
				untilDestroyed(this)
			)
			.subscribe((value) => {
				this.checkForMultiSelectValue(value);
				this.onChange(this.val);
			});
		this.select.valueChanges
			.pipe(
				tap((value) => this.employeeId = value),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe(() => {
				if (!this.allEmployees || this.allEmployees.length === 0) {
					this.getWorkingEmployees();
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

	/**
	 * Get working employees of the selected month
	 */
	private async getWorkingEmployees(): Promise<void> {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { selectedDate } = this.store;

		const { items = [] } = await this.employeesService.getWorking(
			organizationId,
			tenantId,
			selectedDate,
			true
		);
		this.employees = items;
	}

	ngOnDestroy(): void {}
}
