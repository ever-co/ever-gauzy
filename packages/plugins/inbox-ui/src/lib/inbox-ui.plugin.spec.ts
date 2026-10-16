import { Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { NavigationBuilderService, NavMenuBuilderService } from '@gauzy/ui-core/core';
import { INBOX_HEADER_ACTION_ID, INBOX_LINK, INBOX_NAV_ID } from './inbox-ui.constants';
import { INBOX_PAGE_ROUTE, InboxUiPlugin, registerInboxEntryPoints } from './inbox-ui.plugin';
import { InboxAvailabilityService } from './services/inbox-availability.service';

/** The plugin: the route always; the nav entry and the badge only where the API serves the Inbox. */
describe('InboxUiPlugin', () => {
	function injectorWith(available: BehaviorSubject<boolean | null>) {
		const nav = { addNavMenuSection: jest.fn() };
		const header = { registerHeaderAction: jest.fn() };
		const availability = {
			available$: available.pipe() as unknown as InboxAvailabilityService['available$']
		};
		const injector = Injector.create({
			providers: [
				{ provide: NavMenuBuilderService, useValue: nav },
				{ provide: NavigationBuilderService, useValue: header },
				{ provide: InboxAvailabilityService, useValue: availability }
			]
		});
		return { injector, nav, header };
	}

	it('declares /pages/inbox behind INBOX_VIEW, with the INBOX translations', () => {
		expect(InboxUiPlugin.id).toBe('inbox');
		expect(InboxUiPlugin.routes).toEqual([INBOX_PAGE_ROUTE]);
		expect(INBOX_PAGE_ROUTE).toMatchObject({
			location: 'page-sections',
			path: 'inbox',
			data: { permissions: { only: [PermissionsEnum.INBOX_VIEW] } }
		});
		expect(InboxUiPlugin.translationNamespace).toBe('INBOX');
		expect(InboxUiPlugin.translations?.['en']).toHaveProperty('MENU', 'Inbox');
		expect(typeof InboxUiPlugin.bootstrap).toBe('function');
	});

	it('adds the nav entry and the badge once the API answered, and only once', () => {
		const available = new BehaviorSubject<boolean | null>(null);
		const { injector, nav, header } = injectorWith(available);
		registerInboxEntryPoints(injector);
		expect(nav.addNavMenuSection).not.toHaveBeenCalled();

		available.next(true);
		expect(nav.addNavMenuSection).toHaveBeenCalledTimes(1);
		expect(nav.addNavMenuSection.mock.calls[0][0]).toMatchObject({ id: INBOX_NAV_ID, link: INBOX_LINK });
		expect(header.registerHeaderAction).toHaveBeenCalledWith(
			expect.objectContaining({ id: INBOX_HEADER_ACTION_ID, permissions: [PermissionsEnum.INBOX_VIEW] })
		);

		available.next(true);
		expect(nav.addNavMenuSection).toHaveBeenCalledTimes(1);
	});

	it('adds nothing where the API does not serve the Inbox', () => {
		const available = new BehaviorSubject<boolean | null>(false);
		const { injector, nav, header } = injectorWith(available);
		registerInboxEntryPoints(injector);
		expect(nav.addNavMenuSection).not.toHaveBeenCalled();
		expect(header.registerHeaderAction).not.toHaveBeenCalled();
	});
});
