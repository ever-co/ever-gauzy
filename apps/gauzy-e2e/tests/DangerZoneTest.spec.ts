import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dangerZonePage from './support/pages/DangerZone.po';
import { DangerZonePageData } from '../src/support/Base/pagedata/DangerZonePageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Danger zone Test', () => {
	test('Danger zone Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to verify danger zone', async () => {
			// A bare hash-only goto() issued right after login (which ends on the dashboard hash route)
			// is frequently a SAME-DOCUMENT NO-OP: the Angular hash-router never re-renders, so the page
			// stays on the dashboard and the danger-zone card never mounts. Force the hash + settle
			// (mirror the gotoRoute helper in commands.ts), then wait for the danger-zone card header to
			// be visible before interacting.
			await getPage().goto('/#/pages/settings/danger-zone');
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/settings/danger-zone')) {
					location.hash = '#/pages/settings/danger-zone';
				}
			});
			await getPage().waitForTimeout(800);
			await getPage()
				.locator('nb-card-header > h4')
				.filter({ hasText: 'Danger Zone' })
				.first()
				.waitFor({ state: 'visible', timeout: 30000 });
			await dangerZonePage.verifyHeaderTextExist(DangerZonePageData.headerText);
			await dangerZonePage.deleteButtonVisible();
			await dangerZonePage.clickDeleteButton();
			await dangerZonePage.verifyDeleteTextExist(DangerZonePageData.confirmDeleteText);
			await dangerZonePage.deleteInputVisible();
			await dangerZonePage.enterInputData(DangerZonePageData.deleteUserText);
			await dangerZonePage.confirmDeleteButtonVisible();
			await dangerZonePage.cancelButtonVisible();
			await dangerZonePage.clickCancelButton();
			await dangerZonePage.verifyDeleteButtonText(DangerZonePageData.buttonText);
		});
	});
});
