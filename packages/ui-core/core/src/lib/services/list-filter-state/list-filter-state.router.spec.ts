/** `Store` is injected by token only: an empty class keeps the Akita store out of the spec (see the service spec). */
jest.mock('../store/store.service', () => ({ Store: class Store {} }));

import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { BehaviorSubject } from 'rxjs';
import { Store } from '../store/store.service';
import { ListFilterStateService } from './list-filter-state.service';

@Component({ template: '', standalone: true })
class PageComponent {}

/**
 * Drives the real Angular router and a mock browser history, so what the service takes for "the user pressed Back"
 * is what the router really reports for it.
 */
describe('ListFilterStateService with the real router', () => {
	let router: Router;
	let location: Location;
	let service: ListFilterStateService;

	/** Whether the list's guard lets the user in. */
	let listAllowed: boolean;

	beforeEach(async () => {
		listAllowed = true;
		const user$ = new BehaviorSubject({ id: 'user-1', tenantId: 'tenant-1' });
		const organization$ = new BehaviorSubject({ id: 'org-1' });
		TestBed.configureTestingModule({
			providers: [
				provideRouter([
					{ path: 'tasks', component: PageComponent, canActivate: [() => listAllowed] },
					{ path: 'tasks/:id', component: PageComponent },
					{ path: 'employees', component: PageComponent }
				]),
				provideLocationMocks(),
				{
					provide: Store,
					useValue: {
						user$,
						selectedOrganization$: organization$,
						user: user$.getValue(),
						selectedOrganization: organization$.getValue()
					}
				}
			]
		});
		router = TestBed.inject(Router);
		location = TestBed.inject(Location);
		service = TestBed.inject(ListFilterStateService);
		router.initialNavigation(); // the router listens to the history only after this, as at bootstrap
		await router.navigateByUrl('/tasks');
	});

	/** The user filters the list, opens a row, and comes back through `how`. */
	async function leaveAndReturn(how: () => Promise<unknown>) {
		service.record('title', 'login bug');
		service.record('status', { id: 's1', name: 'Open' });
		await router.navigateByUrl('/tasks/42');
		await how();
	}

	it('restores the filters after the browser Back button', async () => {
		await leaveAndReturn(async () => {
			location.back();
			await new Promise((resolve) => setTimeout(resolve));
		});

		expect(router.url).toBe('/tasks');
		expect(service.restore('title')).toBe('login bug');
		expect(service.restore('status')).toEqual({ id: 's1', name: 'Open' });
	});

	it('keeps giving them back for the visit, and again after the next Back', async () => {
		await leaveAndReturn(async () => {
			location.back();
			await new Promise((resolve) => setTimeout(resolve));
		});

		// The list rebuilt its table settings: the new filters ask again and get the same values.
		expect(service.restore('title')).toBe('login bug');
		expect(service.restore('title')).toBe('login bug');

		// The user clears one, opens another row and comes Back.
		service.record('status', null);
		await router.navigateByUrl('/tasks/43');
		location.back();
		await new Promise((resolve) => setTimeout(resolve));

		expect(router.url).toBe('/tasks');
		expect(service.restore('title')).toBe('login bug');
		expect(service.restore('status')).toBeUndefined();
	});

	it('restores the filters after Back even when the app rewrote the query meanwhile', async () => {
		service.record('title', 'login bug');
		await router.navigateByUrl('/tasks/42?organizationId=1');
		location.back();
		await new Promise((resolve) => setTimeout(resolve));
		await router.navigate([], { queryParams: { organizationId: '1' }, replaceUrl: true });

		expect(service.restore('title')).toBe('login bug');
	});

	it('does not restore them when the list is opened by a link or the menu', async () => {
		await leaveAndReturn(() => router.navigateByUrl('/tasks'));

		expect(service.restore('title')).toBeUndefined();
		expect(service.restore('status')).toBeUndefined();
	});

	it('does not restore them after a redirect-style replace of the list', async () => {
		await leaveAndReturn(() => router.navigateByUrl('/tasks', { replaceUrl: true }));

		expect(service.restore('title')).toBeUndefined();
	});

	it('keeps the filters when a guard refuses a visit to the list, for a later Back', async () => {
		service.record('title', 'login bug');
		await router.navigateByUrl('/tasks/42');

		listAllowed = false;
		expect(await router.navigateByUrl('/tasks')).toBe(false);
		expect(router.url).toBe('/tasks/42');

		listAllowed = true;
		location.back();
		await new Promise((resolve) => setTimeout(resolve));

		expect(router.url).toBe('/tasks');
		expect(service.restore('title')).toBe('login bug');
	});
});
