import { AfterViewInit, ChangeDetectorRef, Component, Input } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, ISelectedEmployee, IUser, PermissionsEnum } from '@gauzy/contracts';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-sdk/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-header-title',
	templateUrl: './header-title.component.html',
	styles: [
		`
			.name,
			.org-name {
				font-size: 24px;
				font-weight: 400;
				line-height: 30px;
				letter-spacing: 0em;
				text-align: left;
			}
			:host {
				font-size: 24px;
				font-weight: 600;
				line-height: 30px;
				letter-spacing: 0em;
				text-align: left;
			}
		`
	]
})
export class HeaderTitleComponent implements AfterViewInit {
	PermissionsEnum: typeof PermissionsEnum = PermissionsEnum;
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

	constructor(private readonly store: Store, private readonly crd: ChangeDetectorRef) {
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
