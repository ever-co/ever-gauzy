import { Component, Input, OnInit } from '@angular/core';
import { ID, IEmployee } from '@gauzy/contracts';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
    selector: 'ngx-avatar',
    templateUrl: './avatar.component.html',
    styleUrls: ['./avatar.component.scss'],
    standalone: false
})
export class AvatarComponent implements OnInit {
	public online$: Observable<boolean>;

	@Input() size: 'lg' | 'sm' | 'md' = 'md';
	@Input() src: string;
	@Input() appendCaption: string;
	@Input() caption: string;
	@Input() id: ID;
	@Input() isOption: boolean;

	/**
	 * A class member and getter/setter for managing an employee object.
	 */
	private _employee = new BehaviorSubject<IEmployee>(null);
	@Input() set employee(value: IEmployee) {
		this._employee.next(value);
	}
	get employee(): IEmployee {
		return this._employee.getValue();
	}

	// Added for set component value when used for angular2-smart-table renderer.
	@Input() set value(object: any) {
		for (const key in object) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				this[key] = object[key];
			}
		}
	}

	/**
	 * A class member and getter/setter for managing an employee name.
	 */
	private _name: string;
	@Input() set name(value: string) {
		this._name = value;
	}
	get name(): string {
		return this._name;
	}

	ngOnInit() {
		this.online$ = this._employee.asObservable().pipe(map((employee) => employee?.isOnline && !employee?.isAway));
	}
}
