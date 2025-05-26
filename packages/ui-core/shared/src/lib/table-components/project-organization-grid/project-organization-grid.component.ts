import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Component({
	selector: 'gauzy-project-organization-grid',
	templateUrl: './project-organization-grid.component.html',
	styleUrls: ['./project-organization-grid.component.scss'],
	standalone: false
})
export class ProjectOrganizationGridComponent {
	@Input() value: string | number;
	@Input() isDisabled = false;
	@Output() visibilityClicked = new EventEmitter<boolean>();
	private _rowData: any;
	private _visibility$: BehaviorSubject<boolean>;

	constructor() {
		this._rowData = null;
		this._visibility$ = new BehaviorSubject(null);
	}

	public onVisibilityChange(state: boolean): void {
		this._visibility$.next(state);
		this.visibilityClicked.emit(state);
	}

	public get visibility(): boolean {
		if (this._visibility$.getValue() === null) {
			this._visibility$.next(this.rowData.public === null ? false : this.rowData.public);
		}
		return this._visibility$.getValue();
	}

	@Input()
	public set rowData(value: any) {
		if (value) {
			this._rowData = value;
		}
	}

	public get rowData() {
		return this._rowData;
	}
}
