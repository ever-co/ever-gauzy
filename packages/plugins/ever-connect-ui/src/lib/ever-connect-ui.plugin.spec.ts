import { Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { NavMenuBuilderService } from '@gauzy/ui-core/core';
// A namespace import: this project's spec build has no `esModuleInterop` (the plugin's own default import is the bundler's).
import * as en from '../i18n/en.json';
import {
	EVER_CONNECT_LINK,
	EVER_PLATFORM_NAV_ID,
	EverConnectUiPlugin,
	registerEverPlatformMenu
} from './ever-connect-ui.plugin';
import { EverPlatformMenuService } from './services/ever-platform-menu.service';

/** Settings > Ever Platform: only where the module is loaded, only for the operator of the connection. */
describe('EverConnectUiPlugin menu entry', () => {
	function injectorWith(available: BehaviorSubject<boolean | null>) {
		const nav = { addNavMenuItems: jest.fn() };
		const injector = Injector.create({
			providers: [
				{ provide: NavMenuBuilderService, useValue: nav },
				{ provide: EverPlatformMenuService, useValue: { available$: available.pipe() } }
			]
		});
		return { injector, nav };
	}

	it('keeps the declarative parts and adds a bootstrap for the menu entry', () => {
		expect(EverConnectUiPlugin.id).toBe('ever-connect');
		expect(EverConnectUiPlugin.translationNamespace).toBe('EVER_CONNECT');
		expect(EverConnectUiPlugin.routes?.length).toBe(2);
		expect(typeof EverConnectUiPlugin.bootstrap).toBe('function');
		expect(en).toHaveProperty('MENU', 'Ever Platform');
	});

	it('adds the entry once the probe answered, pointing at the Ever Platform page, and only once', () => {
		const available = new BehaviorSubject<boolean | null>(null);
		const { injector, nav } = injectorWith(available);
		registerEverPlatformMenu(injector);
		expect(nav.addNavMenuItems).not.toHaveBeenCalled();

		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(1);
		const [items, sectionId] = nav.addNavMenuItems.mock.calls[0];
		expect(sectionId).toBe('settings');
		expect(items).toEqual([
			expect.objectContaining({
				id: EVER_PLATFORM_NAV_ID,
				link: EVER_CONNECT_LINK,
				data: expect.objectContaining({
					translationKey: 'EVER_CONNECT.MENU',
					permissionKeys: [PermissionsEnum.INTEGRATION_VIEW]
				})
			})
		]);
		expect(items[0].data.hide()).toBe(false);
		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(1);
	});

	it('never adds it where the probe answers 404 (not loaded, or not the operator)', () => {
		const available = new BehaviorSubject<boolean | null>(false);
		const { injector, nav } = injectorWith(available);
		registerEverPlatformMenu(injector);
		expect(nav.addNavMenuItems).not.toHaveBeenCalled();
	});

	it('hides it again when that changes (signed out), and shows it at the next sign-in', () => {
		const available = new BehaviorSubject<boolean | null>(true);
		const { injector, nav } = injectorWith(available);
		registerEverPlatformMenu(injector);
		available.next(false);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(2);
		expect(nav.addNavMenuItems.mock.calls[1][0][0].data.hide()).toBe(true);
		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(3);
		expect(nav.addNavMenuItems.mock.calls[2][0][0].data.hide()).toBe(false);
	});
});
