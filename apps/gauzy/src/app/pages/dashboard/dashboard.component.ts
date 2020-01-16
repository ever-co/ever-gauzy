import { Component, OnInit, OnDestroy } from '@angular/core';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	selectedEmployee: SelectedEmployee;

	constructor(private store: Store) {}

	ngOnInit(): void {
		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				if (emp) {
					this.selectedEmployee = emp;
				}
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
