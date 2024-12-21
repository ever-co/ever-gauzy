import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IEmployee } from '@gauzy/contracts';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-allow-screenshot-capture',
    templateUrl: './allow-screenshot-capture.component.html',
    styleUrls: ['./allow-screenshot-capture.component.scss'],
    standalone: false
})

export class AllowScreenshotCaptureComponent implements OnInit {
	@Input() value: string | number;
	@Output() allowScreenshotCaptureChange: EventEmitter<boolean>;

	private _rowData: IEmployee;
	private _allowed$: BehaviorSubject<boolean>;

	constructor() {
		this.allowScreenshotCaptureChange = new EventEmitter();
		this._allowed$ = new BehaviorSubject(false);
		this._rowData = null;
	}

	ngOnInit(): void {
		this._allowed$.next(this.rowData.allowScreenshotCapture);
		this.allowScreenshotCaptureChange
			.pipe(
				tap((allowed) => this._allowed$.next(allowed)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public onCheckedChange(event: boolean) {
		this.allowScreenshotCaptureChange.emit(event);
	}

	public get allowed(): boolean {
		return this._allowed$.getValue();
	}

	public get allowed$(): Observable<boolean> {
		return this._allowed$.asObservable();
	}

	@Input()
	public set rowData(value: IEmployee) {
		if (value) {
			this._rowData = value;
		}
	}

	public get rowData(): IEmployee {
		return this._rowData;
	}
}
