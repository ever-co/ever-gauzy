import { FormControl } from '@angular/forms';
import { BehaviorSubject, Subject } from 'rxjs';
import { PermissionGroups, PermissionsEnum } from '@gauzy/contracts';
import { RolesPermissionsComponent } from './roles-permissions.component';

/**
 * #3912 — the page reads each permission's label and description once per language (not twice per row through
 * the pipe), shows the description under the toggle, and its search matches both texts.
 *
 * Only the search and the text stream are exercised, on a bare instance: no template or DI is needed.
 */
describe('RolesPermissionsComponent — permission descriptions (#3912)', () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let built: any[] = [];
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		// Ends each instance's subscriptions (untilDestroyed), as the page does when it is left
		built.forEach((component) => component.ngOnDestroy());
		built = [];
		jest.useRealTimers();
	});

	/** What `TranslateService.stream(keys)` answers in each language; every other key is missing. */
	const lookup = (language: 'en' | 'de', keys: string[]): Record<string, string> => {
		const known: Record<string, Record<'en' | 'de', string>> = {
			'ORGANIZATIONS_PAGE.PERMISSIONS.INVOICES_VIEW': { en: 'View Invoices', de: 'Rechnungen anzeigen' },
			'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.INVOICES_VIEW': {
				en: "See the organization's invoices.",
				de: 'Die Rechnungen sehen.'
			}
		};
		// The missing-translation handler answers a missing key with the key itself
		return Object.fromEntries(keys.map((key) => [key, known[key]?.[language] ?? key]));
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const build = (stream: jest.Mock): any => {
		const component = Object.create(RolesPermissionsComponent.prototype);
		Object.assign(component, {
			permissionGroups: PermissionGroups,
			permissionTexts: new Map(),
			searchControl: new FormControl(''),
			translateService: { stream }
		});
		built.push(component);
		return component;
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const search = (component: any, term: string) => {
		component.searchControl.setValue(term);
		jest.advanceTimersByTime(300);
	};

	it('reads every listed permission in one lookup and keeps only real descriptions', () => {
		const stream = jest.fn((keys: string[]) => new BehaviorSubject(lookup('en', keys)));
		const component = build(stream);

		component._setupSearchFilter();

		expect(stream).toHaveBeenCalledTimes(1);
		const listed = new Set([...PermissionGroups.GENERAL, ...PermissionGroups.ADMINISTRATION]);
		expect(stream.mock.calls[0][0]).toHaveLength(listed.size * 2);
		expect(component.permissionTexts.get(PermissionsEnum.INVOICES_VIEW)).toEqual({
			label: 'View Invoices',
			description: "See the organization's invoices."
		});
		// A permission whose description the catalogue lacks shows no line, never its raw key
		expect(component.permissionTexts.get(PermissionsEnum.ORG_TASK_VIEW).description).toBeUndefined();
	});

	it('finds a permission by its description, and in the new language after a switch', () => {
		const texts$ = new BehaviorSubject<Record<string, string>>({});
		let requested: string[] = [];
		const component = build(
			jest.fn((keys: string[]) => {
				requested = keys;
				texts$.next(lookup('en', keys));
				return texts$;
			})
		);

		component._setupSearchFilter();
		search(component, 'organization');
		expect(component.filteredGeneralPermissions).toContain(PermissionsEnum.INVOICES_VIEW);
		expect(component.generalSections.flatMap((section) => section.permissions)).toContain(
			PermissionsEnum.INVOICES_VIEW
		);

		// The language changes: the stream re-emits, and the search is matched against the new texts at once
		texts$.next(lookup('de', requested));
		expect(component.filteredGeneralPermissions).not.toContain(PermissionsEnum.INVOICES_VIEW);
		search(component, 'rechnungen');
		expect(component.filteredGeneralPermissions).toEqual([PermissionsEnum.INVOICES_VIEW]);
	});

	it('keeps matching the code read as words, as the search always did', () => {
		const component = build(jest.fn((keys: string[]) => new BehaviorSubject(lookup('en', keys))));

		component._setupSearchFilter();
		search(component, 'task view');

		expect(component.filteredGeneralPermissions).toContain(PermissionsEnum.ORG_TASK_VIEW);
	});

	it('lists every permission while the translations are still loading', () => {
		// A stream that has not emitted yet
		const component = build(jest.fn(() => new Subject()));

		component._setupSearchFilter();

		expect(component.filteredGeneralPermissions).toEqual(PermissionGroups.GENERAL);
		expect(component.generalSections.length).toBeGreaterThan(0);
	});
});
