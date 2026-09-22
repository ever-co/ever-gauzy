import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { IEmployee, PermissionsEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IRecordViewSection } from '@gauzy/ui-core/shared';

/**
 * Read-only View of an employee.
 *
 * An employee is a large record — the profile, the employment history, the
 * rates, the location and the networks — so it gets a page of its own rather
 * than the drawer the smaller records use. Nothing here edits: the Edit action
 * links to the existing edit page, behind its own permission.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-employee',
	templateUrl: './view-employee.component.html',
	styleUrls: ['./view-employee.component.scss'],
	standalone: false
})
export class ViewEmployeeComponent extends TranslationBaseComponent implements OnInit {
	public readonly PermissionsEnum = PermissionsEnum;

	public employee: IEmployee;
	public sections: IRecordViewSection[] = [];

	constructor(
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._route.data
			.pipe(
				filter((data: Data) => !!data && !!data.employee),
				tap(({ employee }: Data) => {
					this.employee = employee;
					this.sections = this.buildSections(employee);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Display name, falling back through the shapes the API can return. */
	get displayName(): string {
		const user = this.employee?.user;
		const parts = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
		return this.employee?.fullName || user?.name || parts || '';
	}

	edit(): void {
		if (this.employee) {
			this._router.navigate(['/pages/employees/edit', this.employee.id]);
		}
	}

	/**
	 * Field descriptor for the whole profile, grouped the way the edit page's
	 * tabs are — so someone who knows where a field lives when editing finds it
	 * in the same place when only reading.
	 */
	private buildSections(employee: IEmployee): IRecordViewSection[] {
		return [
			{
				title: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.ACCOUNT',
				fields: [
					{ label: 'FORM.LABELS.NAME', value: this.displayName },
					{ label: 'SM_TABLE.EMAIL', key: 'user.email', type: 'email' },
					{ label: 'FORM.LABELS.PHONE_NUMBER', key: 'user.phoneNumber', type: 'phone' },
					{ label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.POSITION', key: 'organizationPosition.name' },
					{ label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYEE_LEVEL', key: 'employeeLevel' },
					{ label: 'FORM.LABELS.PREFERRED_LANGUAGE', key: 'user.preferredLanguage' },
					{ label: 'SM_TABLE.TIME_TRACKING', key: 'isTrackingEnabled', type: 'boolean' },
					{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true },
					// Skills carry a `name` and a `color`, exactly what the tag chips render.
					{ label: 'POP_UPS.SKILLS', key: 'skills', type: 'tags', wide: true }
				]
			},
			{
				title: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYMENT',
				fields: [
					{ label: 'FORM.LABELS.START_DATE', key: 'startedWorkOn', type: 'date' },
					{ label: 'EMPLOYEES_PAGE.WORK_ENDED', key: 'endWork', type: 'date' },
					{
						label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYMENT_TYPE',
						value: ViewEmployeeComponent.names(employee.organizationEmploymentTypes)
					},
					{
						label: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.DEPARTMENT',
						value: ViewEmployeeComponent.names(employee.organizationDepartments)
					},
					{ label: 'FORM.LABELS.OFFER_DATE', key: 'offerDate', type: 'date' },
					{ label: 'FORM.LABELS.ACCEPT_DATE', key: 'acceptDate', type: 'date' },
					{ label: 'FORM.LABELS.REJECT_DATE', key: 'rejectDate', type: 'date' }
				]
			},
			{
				title: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.RATES',
				fields: [
					{ label: 'FORM.LABELS.PAY_PERIOD', key: 'payPeriod' },
					{ label: 'FORM.LABELS.BILL_RATE', key: 'billRateValue' },
					{ label: 'FORM.LABELS.CURRENCY', key: 'billRateCurrency' },
					{ label: 'FORM.LABELS.BILL_RATE_MIN', key: 'minimumBillingRate' },
					{ label: 'FORM.LABELS.RECURRING_WEEKLY_LIMIT', key: 'reWeeklyLimit' }
				]
			},
			{
				title: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.LOCATION',
				fields: [
					{ label: 'FORM.LABELS.COUNTRY', key: 'contact.country' },
					{ label: 'FORM.LABELS.CITY', key: 'contact.city' },
					{ label: 'FORM.LABELS.ADDRESS', key: 'contact.address' },
					{ label: 'FORM.LABELS.ADDRESS_2', key: 'contact.address2' },
					{ label: 'FORM.LABELS.POSTCODE', key: 'contact.postcode' }
				]
			},
			{
				title: 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.NETWORKS',
				fields: [
					{ label: 'FORM.LABELS.LINKEDIN', key: 'linkedInUrl', type: 'link' },
					{ label: 'FORM.LABELS.FACEBOOK', key: 'facebookUrl', type: 'link' },
					{ label: 'FORM.LABELS.INSTAGRAM', key: 'instagramUrl', type: 'link' },
					{ label: 'FORM.LABELS.TWITTER', key: 'twitterUrl', type: 'link' },
					{ label: 'FORM.LABELS.GITHUB', key: 'githubUrl', type: 'link' },
					{ label: 'FORM.LABELS.GITLAB', key: 'gitlabUrl', type: 'link' },
					{ label: 'FORM.LABELS.UPWORK', key: 'upworkUrl', type: 'link' },
					{ label: 'FORM.LABELS.STACK_OVERFLOW', key: 'stackoverflowUrl', type: 'link' }
				]
			},
			{
				title: 'POP_UPS.DETAILS',
				fields: [
					{ label: 'FORM.LABELS.SHORT_DESCRIPTION', key: 'short_description', type: 'multiline', wide: true },
					{ label: 'FORM.LABELS.DESCRIPTION', key: 'description', type: 'html', wide: true }
				]
			}
		];
	}

	/** Comma-joined names of a relation list, or undefined so the row is dropped. */
	private static names(items: { name?: string }[] | undefined): string | undefined {
		const names = (items || []).map((item) => item?.name).filter(Boolean);
		return names.length ? names.join(', ') : undefined;
	}
}
