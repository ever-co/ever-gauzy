import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Component({
	selector: 'ngx-smart-table-toggle',
	templateUrl: './smart-table-toggle.component.html',
	styleUrls: ['./smart-table-toggle.component.scss']
})
export class SmartTableToggleComponent {
	private _checked$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public get checked$(): Observable<boolean> {
		return this._checked$.asObservable();
	}

	/**
	 * Set the value of the toggle.
	 * @param checked The value to set the toggle to.
	 */
	@Input() public set value(checked: boolean) {
		this._checked$.next(checked);
	}

	/**
	 * Get the value of the toggle.
	 */
	@Output() toggleChange: EventEmitter<boolean> = new EventEmitter();

	/**
	 * Set the value of the toggle.
	 * @param isChecked
	 */
	onCheckedChange(isChecked: boolean) {
		this.toggleChange.emit(isChecked);
		this._checked$.next(isChecked);
	}
}
