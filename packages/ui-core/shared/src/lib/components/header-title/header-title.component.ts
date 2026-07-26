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
			/*
			 * Page title, NOT a breadcrumb trail — the real trail is rendered once
			 * in the header (<ngx-breadcrumbs>). This used to be 24px/600, which
			 * read as an oversized breadcrumb path; a page heading only needs to
			 * out-rank body copy, so it now sits at the h5 step of the type scale.
			 * The org/employee qualifier is deliberately lighter and muted so the
			 * page name is what the eye lands on.
			 */
			:host {
				font-size: 1.25rem;
				font-weight: 600;
				line-height: 1.75rem;
				letter-spacing: -0.01em;
				text-align: left;
			}
			.name,
			.org-name {
				font-size: 1.25rem;
				font-weight: 400;
				line-height: 1.75rem;
				letter-spacing: -0.01em;
				text-align: left;
				color: var(--text-hint-color);
			}
		`
    ],
    standalone: false
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
