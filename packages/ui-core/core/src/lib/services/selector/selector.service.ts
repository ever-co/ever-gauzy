import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class SelectorService {
	private readonly showDateSelectorSubject = new BehaviorSubject<boolean>(true);
	public showDateSelector$ = this.showDateSelectorSubject.asObservable();
	/**
	 * Returns boolean values of selectors
	 * Used to decide whether or not to show organization, employees etc
	 * in the header and organization shortcuts in the sidebar
	 * @param url Usually the current url
	 */
	public showSelectors(url: string): {
		showEmployeesSelector: boolean;
		showDateSelector: boolean;
		showOrganizationsSelector: boolean;
		showOrganizationShortcuts: boolean;
	} {
		let showEmployeesSelector = true;
		let showDateSelector = true;
		let showOrganizationsSelector = true;
		let showOrganizationShortcuts = true;

		if (url.endsWith('/employees')) {
			showEmployeesSelector = false;
			showDateSelector = false;
		}

		const profileRegex = RegExp('/pages/employees/edit/.*/profile', 'i');
		const organizationRegex = RegExp('/pages/organizations/edit/.*/settings', 'i');

		if (profileRegex.test(url)) {
			showEmployeesSelector = false;
			showDateSelector = false;
			showOrganizationsSelector = false;
			showOrganizationShortcuts = false;
		}

		if (organizationRegex.test(url)) {
			showEmployeesSelector = false;
			showDateSelector = false;
			showOrganizationsSelector = false;
			showOrganizationShortcuts = true;
		}

		if (url.endsWith('/pages/auth/profile')) {
			showEmployeesSelector = false;
			showDateSelector = false;
			showOrganizationsSelector = false;
			showOrganizationShortcuts = false;
		}

		if (url.endsWith('/organizations')) {
			showEmployeesSelector = false;
			showDateSelector = false;
			showOrganizationsSelector = false;
			showOrganizationShortcuts = false;
		}

		const organizationEditRegex = RegExp('/pages/organizations/edit/[A-Za-z0-9-]+$', 'i');

		if (organizationEditRegex.test(url)) {
			showEmployeesSelector = false;
			showDateSelector = true;
			showOrganizationsSelector = true;
			showOrganizationShortcuts = true;
		}

		return {
			showEmployeesSelector,
			showDateSelector,
			showOrganizationsSelector,
			showOrganizationShortcuts
		};
	}

	public updateSelectors(url: string): void {
		let showDateSelector = true;
		const addByRoleRegex = /\/pages\/accounting\/invoices\/add-by-role(\?.*)?$/;
		if (addByRoleRegex.test(url)) {
			showDateSelector = false;
		}
		this.showDateSelectorSubject.next(showDateSelector);
	}
}
