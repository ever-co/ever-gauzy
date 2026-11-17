import { Injector, NO_ERRORS_SCHEMA, runInInjectionContext } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { InviteStatusEnum } from '@gauzy/contracts';
import { ListFilterStateService, Store } from '@gauzy/ui-core/core';
import { InputFilterComponent } from './input-filter.component';
import { InviteStatusFilterComponent } from './invite-status-filter.component';
import { RangeFilterComponent } from './range-filter.component';
import { ToggleFilterComponent } from './toggle-filter/toggle-filter.component';

/**
 * The filters as a list renders them: a column with a `filterFunction`, and the service answering what the user left
 * when they opened the row.
 */
describe('column filters restored by Back', () => {
	const filterFunction = jest.fn();
	let saved: Record<string, unknown>;
	const listFilterState = {
		restore: jest.fn((id: string) => saved[id]),
		record: jest.fn()
	};

	function mount<T extends { column: unknown; debounceTime: number }>(type: new () => T): ComponentFixture<T> {
		const fixture = TestBed.createComponent(type);
		fixture.componentInstance.column = { id: 'col', filterFunction };
		fixture.componentInstance.debounceTime = 10;
		fixture.detectChanges();
		return fixture;
	}

	beforeEach(() => {
		saved = {};
		filterFunction.mockReset();
		listFilterState.record.mockReset();
		TestBed.configureTestingModule({
			declarations: [InviteStatusFilterComponent, RangeFilterComponent, ToggleFilterComponent],
			imports: [FormsModule, ReactiveFormsModule, NgSelectModule, TranslateModule.forRoot()],
			providers: [{ provide: ListFilterStateService, useValue: listFilterState }],
			schemas: [NO_ERRORS_SCHEMA]
		});
	});

	describe('invite status (a select)', () => {
		it('shows the status the user left and filters the list by it', async () => {
			saved['col'] = InviteStatusEnum.ACCEPTED;

			const fixture = mount(InviteStatusFilterComponent);
			await fixture.whenStable();
			fixture.detectChanges();

			expect(filterFunction).toHaveBeenCalledWith(InviteStatusEnum.ACCEPTED, 'col');
			expect(fixture.nativeElement.querySelector('.ng-value-label')?.textContent).toContain(
				InviteStatusEnum.ACCEPTED
			);
		});

		it('shows no status when the list is not restored', async () => {
			const fixture = mount(InviteStatusFilterComponent);
			await fixture.whenStable();
			fixture.detectChanges();

			expect(filterFunction).not.toHaveBeenCalled();
			expect(fixture.nativeElement.querySelector('.ng-value-label')).toBeNull();
		});

		it('records a choice and a cleared choice', () => {
			const fixture = mount(InviteStatusFilterComponent);

			fixture.componentInstance.onChange(InviteStatusEnum.INVITED);
			fixture.componentInstance.onChange(undefined);

			expect(listFilterState.record).toHaveBeenNthCalledWith(1, 'col', InviteStatusEnum.INVITED);
			expect(listFilterState.record).toHaveBeenNthCalledWith(2, 'col', null);
			expect(filterFunction).toHaveBeenLastCalledWith(null, 'col');
		});
	});

	describe('range', () => {
		it('shows the range the user left and filters the list by it', fakeAsync(() => {
			saved['col'] = { min: 5, max: 20 };

			const fixture = mount(RangeFilterComponent);
			tick(10);

			expect(fixture.componentInstance.rangeControl.value).toEqual({ min: 5, max: 20 });
			expect(filterFunction).toHaveBeenCalledWith({ min: 5, max: 20 }, 'col');
			fixture.destroy();
		}));

		it('records a typed range', fakeAsync(() => {
			const fixture = mount(RangeFilterComponent);

			fixture.componentInstance.rangeControl.setValue({ min: 1, max: 3 });
			tick(10);

			expect(listFilterState.record).toHaveBeenCalledWith('col', { min: 1, max: 3 });
			fixture.destroy();
		}));

		it('forgets a range cleared of both bounds, so Back does not bring it back', fakeAsync(() => {
			const fixture = mount(RangeFilterComponent);

			fixture.componentInstance.rangeControl.setValue({ min: 5, max: 20 });
			tick(10);
			fixture.componentInstance.rangeControl.setValue({ min: null, max: null });
			tick(10);

			expect(listFilterState.record).toHaveBeenLastCalledWith('col', null);
			// As before, a cleared range does not call the column's filter.
			expect(filterFunction).toHaveBeenCalledTimes(1);
			fixture.destroy();
		}));
	});

	describe('toggle', () => {
		it.each([
			[true, 'accept'],
			[false, 'deny']
		])('puts the toggle back to %s and filters the list by it', (value, choice) => {
			saved['col'] = value;

			const fixture = mount(ToggleFilterComponent);

			expect(fixture.componentInstance.choice).toBe(choice);
			expect(filterFunction).toHaveBeenCalledWith(value, 'col');
		});

		it('leaves the toggle alone when nothing was chosen', () => {
			const fixture = mount(ToggleFilterComponent);

			expect(fixture.componentInstance.choice).toBeUndefined();
			expect(filterFunction).not.toHaveBeenCalled();
		});
	});
});

/**
 * The real service behind the filters, driven by a router double like the service spec's. A page that rebuilds its
 * table settings after the first render (the expenses list drops its employee column for a user who may not change
 * the selected employee) gets new filters from the table: the old ones are destroyed and new ones created, and each
 * new one must show what the list is filtered by.
 */
describe('column filters the table re-creates on a list opened by Back', () => {
	const LIST = '/pages/invites';
	const DETAIL = '/pages/invites/1';
	const filterFunction = jest.fn();
	let service: ListFilterStateService;
	let go: (url: string, trigger?: 'imperative' | 'popstate') => void;

	/** The table creates the invite status filter (a restorable select) for the column. */
	async function mountStatus(): Promise<ComponentFixture<InviteStatusFilterComponent>> {
		const fixture = TestBed.createComponent(InviteStatusFilterComponent);
		fixture.componentInstance.column = { id: 'status', filterFunction } as never;
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		return fixture;
	}

	function shownStatus(fixture: ComponentFixture<InviteStatusFilterComponent>): string | null {
		return fixture.nativeElement.querySelector('.ng-value-label')?.textContent ?? null;
	}

	/** The table creates a text filter for the column, as the input filter's own spec does. */
	function createInput(): InputFilterComponent {
		return TestBed.runInInjectionContext(() => {
			const component = new InputFilterComponent();
			component.column = { id: 'title', filterFunction } as never;
			component.debounceTime = 10;
			component.ngOnInit();
			return component;
		});
	}

	beforeEach(() => {
		filterFunction.mockReset();
		const events$ = new Subject<unknown>();
		const router = { events: events$.asObservable(), url: LIST };
		const user$ = new BehaviorSubject({ id: 'user-1', tenantId: 'tenant-1' });
		const organization$ = new BehaviorSubject({ id: 'org-1' });
		let id = 0;
		go = (url, trigger = 'imperative') => {
			events$.next(new NavigationStart(++id, url, trigger));
			router.url = url;
			events$.next(new NavigationEnd(id, url, url));
		};
		const store = {
			user$,
			selectedOrganization$: organization$,
			get user() {
				return user$.getValue();
			},
			get selectedOrganization() {
				return organization$.getValue();
			}
		};
		// Created in its own injector with the doubles, as in the service spec, so the testing module's router is
		// left alone; created first, as at startup, so it sees the navigations below.
		const injector = Injector.create({
			providers: [
				{ provide: Router, useValue: router },
				{ provide: Store, useValue: store }
			]
		});
		service = runInInjectionContext(injector, () => new ListFilterStateService());
		TestBed.configureTestingModule({
			declarations: [InviteStatusFilterComponent],
			imports: [FormsModule, ReactiveFormsModule, NgSelectModule, TranslateModule.forRoot()],
			providers: [{ provide: ListFilterStateService, useValue: service }],
			schemas: [NO_ERRORS_SCHEMA]
		});
	});

	it('shows the restored choice again in the filter the table re-creates', async () => {
		service.record('status', InviteStatusEnum.ACCEPTED);
		go(DETAIL);
		go(LIST, 'popstate');

		const first = await mountStatus();
		expect(shownStatus(first)).toContain(InviteStatusEnum.ACCEPTED);
		first.destroy(); // the page rebuilt its settings: the table drops its filters...

		const second = await mountStatus(); // ...and creates new ones
		expect(shownStatus(second)).toContain(InviteStatusEnum.ACCEPTED);
		expect(filterFunction).toHaveBeenCalledTimes(2);
		expect(filterFunction).toHaveBeenLastCalledWith(InviteStatusEnum.ACCEPTED, 'status');
	});

	it('keeps a choice the user cleared out of the filter the table re-creates', async () => {
		service.record('status', InviteStatusEnum.ACCEPTED);
		go(DETAIL);
		go(LIST, 'popstate');
		const first = await mountStatus();

		first.componentInstance.onChange(undefined); // the user clears the select
		first.destroy();
		filterFunction.mockReset();

		const second = await mountStatus();
		expect(shownStatus(second)).toBeNull();
		expect(filterFunction).not.toHaveBeenCalled();
	});

	it('shows nothing on a list opened by a link, however often the table creates its filters', async () => {
		service.record('status', InviteStatusEnum.ACCEPTED);
		go(DETAIL);
		go(LIST); // a menu click or a link

		(await mountStatus()).destroy();
		const second = await mountStatus();

		expect(shownStatus(second)).toBeNull();
		expect(filterFunction).not.toHaveBeenCalled();
	});

	it('shows the latest choice after the user leaves the restored list and comes Back', async () => {
		service.record('status', InviteStatusEnum.ACCEPTED);
		go(DETAIL);
		go(LIST, 'popstate');
		const first = await mountStatus();

		first.componentInstance.onChange(InviteStatusEnum.INVITED);
		first.destroy(); // the user opens another row
		go('/pages/invites/2');
		go(LIST, 'popstate');

		const second = await mountStatus();
		expect(shownStatus(second)).toContain(InviteStatusEnum.INVITED);
		expect(filterFunction).toHaveBeenLastCalledWith(InviteStatusEnum.INVITED, 'status');
	});

	it('fills and applies a text filter the table re-created before the first one filtered the list', fakeAsync(() => {
		service.record('title', 'login bug');
		go(DETAIL);
		go(LIST, 'popstate');

		// The employees list rebuilds its settings 100 ms after it opens, inside the filter's debounce: the first
		// input is gone before it filters the list.
		createInput().ngOnDestroy();
		tick(10);
		expect(filterFunction).not.toHaveBeenCalled();

		const second = createInput();
		tick(10);

		expect(second.inputControl.value).toBe('login bug');
		expect(filterFunction).toHaveBeenCalledWith('login bug', 'title');
		second.ngOnDestroy();
	}));
});
