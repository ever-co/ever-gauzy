import { Injectable } from '@angular/core';

@Injectable()
export class SelectorService {
	/**
	 * Returns boolean values of selectors
	 * Used to decide whether or not to show organization, employees etc
	 * in the header and organization shortcuts in the sidebar
	 * @param url Usually the current url
	 */
	public showSelectors(
		url: string
	): {
		showEmployeesSelector: boolean;
		showDateSelector: boolean;
		showOrganizationsSelector: boolean;
	} {
		let showEmployeesSelector = true;
		let showDateSelector = true;
		let showOrganizationsSelector = true;

		if (url.endsWith('/employees')) {
			showEmployeesSelector = false;
			showDateSelector = false;
		}

		const profileRegex = RegExp('/pages/employees/edit/.*/profile', 'i');
		const organizationRegex = RegExp(
			'/pages/organizations/edit/.*/settings',
			'i'
		);

		if (profileRegex.test(url) || organizationRegex.test(url)) {
			showEmployeesSelector = false;
			showDateSelector = false;
			showOrganizationsSelector = false;
		}

		if (url.endsWith('/pages/auth/profile')) {
			showEmployeesSelector = false;
			showDateSelector = false;
			showOrganizationsSelector = false;
		}

		if (url.endsWith('/organizations')) {
			showEmployeesSelector = false;
			showDateSelector = false;
			showOrganizationsSelector = false;
		}

		const organizationEditRegex = RegExp(
			'/pages/organizations/edit/[A-Za-z0-9-]+$',
			'i'
		);

		if (organizationEditRegex.test(url)) {
			showEmployeesSelector = false;
			showDateSelector = true;
			showOrganizationsSelector = true;
		}

		return {
			showEmployeesSelector,
			showDateSelector,
			showOrganizationsSelector
		};
	}
}
