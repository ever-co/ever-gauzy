import { Component, OnInit } from '@angular/core';
import { Store } from './../../../../@core';
import { ISelectedEmployee } from '@gauzy/contracts';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-employee-title',
	templateUrl: './employee-title.component.html',
	styleUrls: []
})
export class EmployeeTitleComponent implements OnInit {

	employee: ISelectedEmployee;

	constructor(
		private readonly store: Store,
	) {}

	ngOnInit() {
		this.store.selectedEmployee$
			.pipe(
				tap((employee) => this.employee = employee),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
