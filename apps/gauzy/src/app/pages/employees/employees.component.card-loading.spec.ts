import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { EmployeesComponent } from './employees.component';

/**
 * The card grid draws its card-shaped placeholder while `loading` is true and "no records" once it is false. The
 * source's set-up puts `loading` back at once, before any employee is read: the grid must stay loading until its
 * page is read, or it says there are no employees while they come (#12012).
 */
describe('EmployeesComponent card grid loading state', () => {
	const cardGrid = () => {
		const component = Object.create(EmployeesComponent.prototype) as EmployeesComponent & Record<string, any>;
		component.dataLayoutStyle = ComponentLayoutStyleEnum.CARDS_GRID;
		component['cardsRequest'] = 0;
		component['_pagination'] = { activePage: 1, itemsPerPage: 10 };
		component.organization = { id: 'org-1' };
		component.employees = [];
		// As the real set-up does: a new source, and `loading` true then false right away
		component['setSmartTableSource'] = jest.fn(() => {
			component.loading = true;
			component.loading = false;
		});
		let answer: () => void;
		component.smartTableSource = {
			setPaging: jest.fn(),
			// The source's `finalize` ends the loading state once the page is read
			getElements: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						answer = () => {
							component.loading = false;
							resolve();
						};
					})
			),
			getData: jest.fn(() => [{ id: 'person-1' }])
		};
		return { component, answer: () => answer() };
	};

	it('stays loading while the page is read, so the grid never says there are no employees meanwhile', async () => {
		const { component, answer } = cardGrid();

		const reading = component['getEmployees']();
		await Promise.resolve();

		expect(component.loading).toBe(true);
		expect(component.employees).toEqual([]);

		answer();
		await reading;

		expect(component.loading).toBe(false);
		expect(component.employees).toEqual([{ id: 'person-1' }]);
	});

	it('lets only the newest source end the loading state, so an older answer never says there are no employees', () => {
		const component = Object.create(EmployeesComponent.prototype) as EmployeesComponent & Record<string, any>;
		component.organization = { id: 'org-1', tenantId: 'tenant-1' };
		component.filters = {};
		component['_httpClient'] = {};
		component.updatePagination = jest.fn();

		// A first Kind's source, then the next Kind's, whose page is still being read
		component.setSmartTableSource();
		const older = component.smartTableSource;
		component.setSmartTableSource();
		const newer = component.smartTableSource;
		component.loading = true;

		older['conf'].finalize();

		expect(component.loading).toBe(true);
		expect(component.updatePagination).not.toHaveBeenCalled();

		newer['conf'].finalize();

		expect(component.loading).toBe(false);
		expect(component.updatePagination).toHaveBeenCalledWith(0);
	});
});

describe('EmployeesComponent card body spinner', () => {
	const componentIn = (layout: ComponentLayoutStyleEnum, loading: boolean) => {
		const component = Object.create(EmployeesComponent.prototype) as EmployeesComponent;
		component.dataLayoutStyle = layout;
		component.loading = loading;
		return component;
	};

	it('stays off over the card grid, which draws its own placeholder while it reads', () => {
		expect(componentIn(ComponentLayoutStyleEnum.CARDS_GRID, true).showsBodySpinner).toBe(false);
	});

	it('CONTROL: still shows over the table while it reads, and over nothing once read', () => {
		expect(componentIn(ComponentLayoutStyleEnum.TABLE, true).showsBodySpinner).toBe(true);
		expect(componentIn(ComponentLayoutStyleEnum.TABLE, false).showsBodySpinner).toBe(false);
	});
});
