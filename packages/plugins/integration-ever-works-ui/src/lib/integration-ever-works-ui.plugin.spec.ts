import { Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { NavMenuBuilderService } from '@gauzy/ui-core/core';
// A namespace import: this project's spec build has no `esModuleInterop` (the plugin's own default import is the bundler's).
import * as en from '../i18n/en.json';
import {
	EVER_WORKS_INBOX_LINK,
	EVER_WORKS_INBOX_NAV_ID,
	EVER_WORKS_INBOX_ROUTE,
	EVER_WORKS_ROUTE,
	IntegrationEverWorksUiPlugin,
	registerEverWorksInboxSettingsEntryPoints
} from './integration-ever-works-ui.plugin';
import { EverWorksInboxAvailabilityService } from './services/ever-works-inbox-availability.service';

/** The plugin: Integrations > Ever Works for admins; Settings → Ever Works inbox for anyone with the Inbox, once served. */
describe('IntegrationEverWorksUiPlugin', () => {
	function injectorWith(available: BehaviorSubject<boolean | null>) {
		const nav = { addNavMenuItems: jest.fn() };
		const injector = Injector.create({
			providers: [
				{ provide: NavMenuBuilderService, useValue: nav },
				{ provide: EverWorksInboxAvailabilityService, useValue: { available$: available.pipe() } }
			]
		});
		return { injector, nav };
	}

	it('declares the Integrations page as before and the settings page behind INBOX_VIEW only', () => {
		expect(IntegrationEverWorksUiPlugin.id).toBe('integration-ever-works');
		expect(IntegrationEverWorksUiPlugin.routes).toEqual([EVER_WORKS_ROUTE, EVER_WORKS_INBOX_ROUTE]);
		expect(EVER_WORKS_ROUTE).toMatchObject({
			location: 'integrations-sections',
			path: 'ever-works',
			data: { permissions: { only: [PermissionsEnum.INTEGRATION_VIEW] } }
		});
		expect(EVER_WORKS_INBOX_ROUTE).toMatchObject({
			location: 'settings-sections',
			path: 'ever-works-inbox',
			data: { permissions: { only: [PermissionsEnum.INBOX_VIEW] }, selectors: { organization: false } }
		});
		expect(EVER_WORKS_INBOX_LINK).toBe('/pages/settings/ever-works-inbox');
		expect(IntegrationEverWorksUiPlugin.translationNamespace).toBe('EVER_WORKS');
		// The nav entry's translation key is there.
		expect(en).toHaveProperty('INBOX_PREFERENCES.MENU', 'Ever Works inbox');
		expect(en).toHaveProperty('INBOX_PREFERENCES.TITLE', 'Send to Ever Works');
		expect(typeof IntegrationEverWorksUiPlugin.bootstrap).toBe('function');
	});

	it('adds the settings entry once the API answered my preferences, and only once', () => {
		const available = new BehaviorSubject<boolean | null>(null);
		const { injector, nav } = injectorWith(available);
		registerEverWorksInboxSettingsEntryPoints(injector);
		expect(nav.addNavMenuItems).not.toHaveBeenCalled();

		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(1);
		const [items, sectionId] = nav.addNavMenuItems.mock.calls[0];
		expect(sectionId).toBe('settings');
		expect(items).toEqual([
			expect.objectContaining({
				id: EVER_WORKS_INBOX_NAV_ID,
				link: EVER_WORKS_INBOX_LINK,
				data: expect.objectContaining({
					translationKey: 'EVER_WORKS.INBOX_PREFERENCES.MENU',
					permissionKeys: [PermissionsEnum.INBOX_VIEW]
				})
			})
		]);
		expect(items[0].data.hide()).toBe(false);

		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(1);
	});

	it('never adds it where the API does not serve it (404 / 403 → false)', () => {
		const available = new BehaviorSubject<boolean | null>(false);
		const { injector, nav } = injectorWith(available);
		registerEverWorksInboxSettingsEntryPoints(injector);
		expect(nav.addNavMenuItems).not.toHaveBeenCalled();
	});

	it('hides it again when that changes (signed out), and shows it at the next sign-in', () => {
		const available = new BehaviorSubject<boolean | null>(true);
		const { injector, nav } = injectorWith(available);
		registerEverWorksInboxSettingsEntryPoints(injector);
		available.next(false);
		// Added again (it replaces itself), so the menu is built anew and reads `hide`.
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(2);
		expect(nav.addNavMenuItems.mock.calls[1][0][0].data.hide()).toBe(true);
		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(3);
		expect(nav.addNavMenuItems.mock.calls[2][0][0].data.hide()).toBe(false);
	});
});
