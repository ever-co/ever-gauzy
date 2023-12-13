import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';

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

	// Added for set component value when used for ng2-smart-table renderer.
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

	constructor(
		private readonly router: Router
	) { }

	ngOnInit() { }

	edit(id: string) {
		if (id) {
			this.router.navigate(['/pages/employees/edit/', id]);
		}
	}
}
