// The window's component (loaded on the first open) names the ui-core barrel, which boots half the app: it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { NbOverlayService, NbPositionBuilderService } from '@nebular/theme';
import { Subject, of } from 'rxjs';
import { ChatAvailabilityService } from './chat-availability.service';
import { ChatDockService, pageOf } from './chat-dock.service';

const ANNA = { employeeId: 'e-anna', userId: 'u-anna', name: 'Anna', imageUrl: null };

describe('pageOf', () => {
	it('keeps the path and drops the query, the fragment and matrix parameters', () => {
		expect(pageOf('/pages/employees/view/e1')).toBe('/pages/employees/view/e1');
		expect(pageOf('/pages/employees/view/e1?tab=2')).toBe('/pages/employees/view/e1');
		expect(pageOf('/pages/employees/view/e1#top')).toBe('/pages/employees/view/e1');
		expect(pageOf('/pages/employees/view/e1;mode=edit')).toBe('/pages/employees/view/e1');
	});
});

describe('ChatDockService', () => {
	let service: ChatDockService;
	let events: Subject<unknown>;
	let dispose: jest.Mock;
	const router = { url: '/pages/employees/view/e-anna', events: null as unknown as Subject<unknown> };
	const navigate = (url: string) => events.next(new NavigationEnd(1, url, url));

	beforeEach(() => {
		events = new Subject();
		router.events = events;
		router.url = '/pages/employees/view/e-anna';
		dispose = jest.fn();
		const position = { bottom: () => position, right: () => position };
		TestBed.configureTestingModule({
			providers: [
				{ provide: Router, useValue: router },
				{ provide: NbOverlayService, useValue: { create: () => ({ attach: jest.fn(), dispose }), scrollStrategies: { noop: () => ({}) } } },
				{ provide: NbPositionBuilderService, useValue: { global: () => position } },
				{ provide: ChatAvailabilityService, useValue: { scope$: of('scope') } }
			]
		});
		service = TestBed.inject(ChatDockService);
	});

	it('closes when the user leaves the page it was opened on', async () => {
		await service.open(ANNA);
		expect(service.person()).toEqual(ANNA);

		navigate('/pages/employees');

		expect(service.person()).toBeNull();
		expect(dispose).toHaveBeenCalled();
	});

	it('stays open while the user stays on the page (a query change is the same page)', async () => {
		await service.open(ANNA);

		navigate('/pages/employees/view/e-anna?tab=time');

		expect(service.person()).toEqual(ANNA);
		expect(dispose).not.toHaveBeenCalled();
	});

	it('stops watching the navigation once closed', async () => {
		await service.open(ANNA);
		service.close();
		dispose.mockClear();

		navigate('/pages/employees');

		expect(dispose).not.toHaveBeenCalled();
	});
});
