import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ID } from '@gauzy/contracts';
import { EmployeesService } from '@gauzy/ui-core/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
	selector: 'ngx-avatar',
	templateUrl: './avatar.component.html',
	styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
	@Input() size: 'lg' | 'sm' | 'md' = 'md';
	@Input() src: string;
	@Input() appendCaption: string;
	@Input() caption: string;
	@Input() id: string;
	@Input() isOption: boolean;

	online$: Observable<boolean>;

	// Added for set component value when used for angular2-smart-table renderer.
	@Input() set value(object) {
		for (const key in object) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				this[key] = object[key];
			}
		}
	}

	/**
	 * A class member and getter/setter for managing a string name.
	 */
	_name: string;

	/**
	 * Getter method for the 'name' property, providing access to the private _name variable.
	 * @returns The current value of the 'name' property.
	 */
	get name(): string {
		return this._name;
	}

	/**
	 * Setter method for the 'name' property, annotated with @Input().
	 * @param value - The new value to set for the 'name' property.
	 */
	@Input() set name(value: string) {
		this._name = value;
	}

	constructor(private readonly router: Router, private readonly _employeeService: EmployeesService) {}

	ngOnInit() {
		if (this.id) {
			this.online$ = this._employeeService
				.getEmployeeById(this.id)
				.pipe(map((employee) => employee?.isOnline && !employee?.isAway));
		}
	}

	/**
	 * Navigates to the employee edit page based on the provided employee ID.
	 *
	 * @param id - The ID of the employee to edit.
	 */
	edit(id: ID): void {
		if (id) {
			this.router.navigate([`/pages/employees/edit/${id}`]);
		}
	}
}
