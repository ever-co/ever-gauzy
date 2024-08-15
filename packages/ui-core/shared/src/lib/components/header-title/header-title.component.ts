import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { IOrganization, ISelectedEmployee, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

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
export class HeaderTitleComponent implements OnInit {
	PermissionsEnum: typeof PermissionsEnum = PermissionsEnum;
	organization: IOrganization;
	employee: ISelectedEmployee;

	_allowEmployee: boolean = true;
	get allowEmployee(): boolean {
		return this._allowEmployee;
	}
	@Input() set allowEmployee(value: boolean) {
		this._allowEmployee = value;
	}

	constructor(private readonly store: Store, private readonly crd: ChangeDetectorRef) {}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization)
		);
		const storeEmployee$ = this.store.selectedEmployee$;

		combineLatest({ organization: storeOrganization$, employee: storeEmployee$ })
			.pipe(
				tap(({ organization, employee }) => {
					this.organization = organization;
					this.employee = employee;
					this.crd.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
