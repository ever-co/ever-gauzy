import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-visibility',
    templateUrl: './visibility.component.html',
    styleUrls: ['./visibility.component.scss'],
    standalone: false
})
export class VisibilityComponent implements OnInit {
	@Input() value: string | number;
	@Output() visibilityChange: EventEmitter<boolean>;

	private _rowData: any;
	private _visibility$: BehaviorSubject<boolean>;

	constructor() {
		this.visibilityChange = new EventEmitter();
		this._visibility$ = new BehaviorSubject(false);
	}

	ngOnInit(): void {
		this._visibility$.next(this.rowData.public);
		this.visibilityChange
			.pipe(
				tap((isPublic: boolean) => this._visibility$.next(isPublic)),
				untilDestroyed(this)
			)
			.subscribe()
	}

	onCheckedChange(event: boolean) {
		this.visibilityChange.emit(event);
	}

	public get visibility$(): Observable<boolean> {
		return this._visibility$.asObservable();
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
