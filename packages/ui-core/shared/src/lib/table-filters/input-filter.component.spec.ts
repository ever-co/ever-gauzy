import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ListFilterStateService } from '@gauzy/ui-core/core';
import { InputFilterComponent } from './input-filter.component';

describe('InputFilterComponent', () => {
	const filterFunction = jest.fn();
	let listFilterState: { restore: jest.Mock; record: jest.Mock };

	const create = (): InputFilterComponent =>
		TestBed.runInInjectionContext(() => {
			const component = new InputFilterComponent();
			component.column = { id: 'title', filterFunction } as never;
			component.debounceTime = 10;
			component.ngOnInit();
			return component;
		});

	beforeEach(() => {
		filterFunction.mockReset();
		listFilterState = { restore: jest.fn().mockReturnValue(undefined), record: jest.fn() };
		TestBed.configureTestingModule({
			providers: [{ provide: ListFilterStateService, useValue: listFilterState }]
		});
	});

	it('shows the filter the list is opened with by Back, and filters the list by it', fakeAsync(() => {
		listFilterState.restore.mockReturnValue('login bug');

		const component = create();
		tick(10);

		expect(listFilterState.restore).toHaveBeenCalledWith('title');
		expect(component.inputControl.value).toBe('login bug');
		expect(filterFunction).toHaveBeenCalledWith('login bug', 'title');
		component.ngOnDestroy();
	}));

	it('stays empty and filters nothing when there is nothing to restore', fakeAsync(() => {
		const component = create();
		tick(10);

		expect(component.inputControl.value).toBeNull();
		expect(filterFunction).not.toHaveBeenCalled();
		component.ngOnDestroy();
	}));

	it('records what the user types, so a later Back can restore it', fakeAsync(() => {
		const component = create();

		component.inputControl.setValue('crash');
		tick(10);

		expect(listFilterState.record).toHaveBeenCalledWith('title', 'crash');
		expect(filterFunction).toHaveBeenCalledWith('crash', 'title');
		component.ngOnDestroy();
	}));
});
