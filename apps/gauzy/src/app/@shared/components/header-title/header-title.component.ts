import { AfterViewInit, ChangeDetectorRef, Component, Input } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, ISelectedEmployee, IUser } from '@gauzy/contracts';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Store } from './../../../@core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-header-title',
	templateUrl: './header-title.component.html',
	styleUrls: []
})
export class HeaderTitleComponent implements AfterViewInit {
	
	user: IUser;
	organization: IOrganization;
	employee: ISelectedEmployee;

	_allowEmployee: boolean = true;
	get allowEmployee(): boolean {
		return this._allowEmployee;
	}
	@Input() set allowEmployee(value: boolean) {
		this._allowEmployee = value;
	}
	
	constructor(
		private readonly store: Store,
		private readonly crd: ChangeDetectorRef
	) {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.employee = employee;
					this.crd.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
