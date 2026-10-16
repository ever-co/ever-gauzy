import { Subject } from 'rxjs';
import { ComponentLayoutStyleEnum, EmployeeKindEnum } from '@gauzy/contracts';
import { EmployeesComponent } from './employees.component';

/**
 * Changing the Kind filter goes back to the first page in both layouts — a later page of the previous list
 * can be past the end of the filtered one — and asks for the list once.
 */
describe('EmployeesComponent Kind filter', () => {
	const pageOf = (layout: ComponentLayoutStyleEnum) => {
		const component = Object.create(EmployeesComponent.prototype) as EmployeesComponent & Record<string, any>;
		component.dataLayoutStyle = layout;
		component['cardsRequest'] = 0; // a field initializer, which Object.create skips
		component['_pagination'] = { activePage: 3, itemsPerPage: 10 };
		component['pagination$'] = { next: jest.fn() };
		component.refresh$ = new Subject<boolean>();
		component.employees$ = new Subject<boolean>();
		const listRequests = jest.fn();
		component.employees$.subscribe(listRequests);
		return { component, listRequests };
	};

	it.each([ComponentLayoutStyleEnum.TABLE, ComponentLayoutStyleEnum.CARDS_GRID])(
		'resets the active page to 1 (%s layout) and asks for the filtered list',
		(layout) => {
			const { component, listRequests } = pageOf(layout);

			component.changeKindFilter(EmployeeKindEnum.AGENT);

			expect(component.kindFilter).toBe(EmployeeKindEnum.AGENT);
			expect(component.pagination).toEqual({ activePage: 1, itemsPerPage: 10 });
			expect(component['pagination$'].next).toHaveBeenCalledWith({ activePage: 1, itemsPerPage: 10 });
			expect(listRequests).toHaveBeenCalledTimes(1);
		}
	);

	it('drops a card-grid page of the previous list that arrives after the Kind changed', async () => {
		const { component } = pageOf(ComponentLayoutStyleEnum.CARDS_GRID);
		let arrive: () => void;
		component.organization = { id: 'org-1' };
		component.employees = [];
		component['setSmartTableSource'] = jest.fn();
		component.smartTableSource = {
			setPaging: jest.fn(),
			getElements: jest.fn(() => new Promise<void>((resolve) => (arrive = resolve))),
			getData: jest.fn(() => [{ id: 'person-1' }])
		};

		const loading = component['getEmployees']();
		component.changeKindFilter(EmployeeKindEnum.AGENT);
		arrive();
		await loading;

		expect(component.employees).toEqual([]);
	});

	it('CONTROL: a card-grid page that arrives with no change in between is appended', async () => {
		const { component } = pageOf(ComponentLayoutStyleEnum.CARDS_GRID);
		component.organization = { id: 'org-1' };
		component.employees = [];
		component['setSmartTableSource'] = jest.fn();
		component.smartTableSource = {
			setPaging: jest.fn(),
			getElements: jest.fn(async () => undefined),
			getData: jest.fn(() => [{ id: 'person-1' }])
		};

		await component['getEmployees']();

		expect(component.employees).toEqual([{ id: 'person-1' }]);
	});

	it('back to every employee', () => {
		const { component } = pageOf(ComponentLayoutStyleEnum.TABLE);
		component.changeKindFilter('');
		expect(component.kindFilter).toBe('');
	});
});
