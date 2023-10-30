import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ViewCell } from 'ng2-smart-table';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-github-auto-sync-switch',
	templateUrl: './auto-sync-switch.component.html',
	styleUrls: ['./auto-sync-switch.component.scss']
})
export class GithubAutoSyncSwitchComponent implements OnInit, ViewCell {

	private _autoSync$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public get autoSync$(): Observable<boolean> {
		return this._autoSync$.asObservable();
	}

	/*
	* Getter & Setter for dynamic enabled/disabled element
	*/
	_value: any;
	get value(): any {
		return this._value;
	}
	@Input() set value(value: any) {
		this._autoSync$.next(value);
		this._value = value;
	}

	@Input() rowData: any;

	@Output() autoSyncChange: EventEmitter<boolean> = new EventEmitter();

	constructor() { }

	ngOnInit(): void {
		this.autoSyncChange
			.pipe(
				tap((enable: boolean) => this._autoSync$.next(enable)),
				untilDestroyed(this)
			)
			.subscribe()
	}

	/**
	 *
	 * @param event
	 */
	onCheckedChange(event: boolean) {
		this.autoSyncChange.emit(event);
	}
}
