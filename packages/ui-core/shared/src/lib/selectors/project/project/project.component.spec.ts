import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { IOrganization, IOrganizationProject } from '@gauzy/contracts';
import {
	ErrorHandlingService,
	NavigationService,
	OrganizationProjectStore,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { ProjectSelectorComponent } from './project.component';

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
	let resolve: (value: T) => void;
	const promise = new Promise<T>((settle) => (resolve = settle));
	return { promise, resolve };
}

/** Lets the awaited project requests and the selection that follows them run. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

/*
 * Built by hand: what is under test is how the selector loads and picks projects, not its template, and
 * constructing it directly keeps the request timing in the spec's hands.
 */
describe('ProjectSelectorComponent', () => {
	const organization = { id: 'organization-1', tenantId: 'tenant-1' } as IOrganization;
	const project = (id: string, organizationContactId?: string) =>
		({ id, name: id, organizationContactId }) as IOrganizationProject;

	let getAll: jest.Mock;
	let getAllByEmployee: jest.Mock;
	let queryParams$: BehaviorSubject<Record<string, string>>;
	let component: ProjectSelectorComponent;

	beforeEach(() => {
		getAll = jest.fn();
		getAllByEmployee = jest.fn();
		queryParams$ = new BehaviorSubject<Record<string, string>>({});
		component = new ProjectSelectorComponent(
			{ getAll, getAllByEmployee } as unknown as OrganizationProjectsService,
			{
				selectedOrganization$: of(organization),
				userRolePermissions$: of([]),
				hasAnyPermission: () => true
			} as unknown as Store,
			{ success: jest.fn() } as unknown as ToastrService,
			{ handleError: jest.fn() } as unknown as ErrorHandlingService,
			{} as OrganizationProjectStore,
			{ updateQueryParams: jest.fn() } as unknown as NavigationService,
			{ queryParams: queryParams$ } as unknown as ActivatedRoute
		);
		component.showAllOption = false;
	});

	afterEach(() => component.ngOnDestroy());

	it("keeps the latest client's projects when an earlier request answers last", async () => {
		const acme = deferred<{ items: IOrganizationProject[] }>();
		const globex = deferred<{ items: IOrganizationProject[] }>();
		getAll.mockReturnValueOnce(acme.promise).mockReturnValueOnce(globex.promise);
		component.organization = organization;

		component.organizationContactId = 'client-acme';
		const acmeRequest = component.getProjects();
		component.organizationContactId = 'client-globex';
		const globexRequest = component.getProjects();

		globex.resolve({ items: [project('globex-site', 'client-globex')] });
		await globexRequest;
		acme.resolve({ items: [project('acme-site', 'client-acme')] });
		await acmeRequest;

		expect(component.projects.map(({ id }) => id)).toEqual(['globex-site']);
	});

	/*
	 * A form narrows the list to a client or an employee. Until the new list loads, the previous one's projects
	 * must not be offered: one picked meanwhile would not belong to the new client or employee.
	 */
	describe('narrowed to another client or employee', () => {
		const ids = () => component.projects.map(({ id }) => id);

		it("offers none of the previous client's projects while the new client's list loads", async () => {
			getAll.mockResolvedValue({ items: [project('acme-site', 'client-acme')] });
			component.organizationContactId = 'client-acme';
			component.ngOnInit();
			await flush();
			expect(ids()).toEqual(['acme-site']);

			const globex = deferred<{ items: IOrganizationProject[] }>();
			getAll.mockReturnValueOnce(globex.promise);
			component.organizationContactId = 'client-globex';

			expect(component.projects).toEqual([]);

			globex.resolve({ items: [project('globex-site', 'client-globex')] });
			await flush();

			expect(ids()).toEqual(['globex-site']);
		});

		it("does not offer the previous client's projects again when the new client's list fails to load", async () => {
			getAll.mockResolvedValue({ items: [project('acme-site', 'client-acme')] });
			component.organizationContactId = 'client-acme';
			component.ngOnInit();
			await flush();
			const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);

			try {
				getAll.mockRejectedValueOnce(new Error('API unreachable'));
				component.organizationContactId = 'client-globex';
				await flush();

				expect(component.projects).toEqual([]);
			} finally {
				quiet.mockRestore();
			}
		});

		it("offers none of the previous employee's projects while the new employee's list loads", async () => {
			getAllByEmployee.mockResolvedValue([project('alice-site')]);
			component.employeeId = 'employee-alice';
			component.ngOnInit();
			await flush();
			expect(ids()).toEqual(['alice-site']);

			const bob = deferred<IOrganizationProject[]>();
			getAllByEmployee.mockReturnValueOnce(bob.promise);
			component.employeeId = 'employee-bob';

			expect(component.projects).toEqual([]);

			bob.resolve([project('bob-site')]);
			await flush();

			expect(ids()).toEqual(['bob-site']);
		});

		it('keeps its list while it reloads for the same client, e.g. when the page query changes', async () => {
			getAll.mockResolvedValue({ items: [project('acme-site', 'client-acme')] });
			component.organizationContactId = 'client-acme';
			component.ngOnInit();
			await flush();

			const reload = deferred<{ items: IOrganizationProject[] }>();
			getAll.mockReturnValueOnce(reload.promise);
			queryParams$.next({ date: '2026-10-31' });

			expect(ids()).toEqual(['acme-site']);

			reload.resolve({ items: [project('acme-site', 'client-acme')] });
			await flush();
		});
	});

	describe("the page's project (?projectId=)", () => {
		beforeEach(() => {
			getAll.mockResolvedValue({
				items: [project('page-project', 'client-acme'), project('picked-project', 'client-acme')]
			});
			queryParams$.next({ projectId: 'page-project' });
		});

		describe("in a form's selector", () => {
			beforeEach(() => (component.skipGlobalChange = true));

			it('is the starting value', async () => {
				component.ngOnInit();
				await flush();

				expect(component.projectId).toBe('page-project');
			});

			it('does not replace the project picked in the form when its list reloads for a client', async () => {
				component.ngOnInit();
				await flush();
				component.writeValue('picked-project');

				component.organizationContactId = 'client-acme';
				await flush();

				expect(component.projectId).toBe('picked-project');
			});

			it('does not bring the page project back once the form cleared it', async () => {
				component.ngOnInit();
				await flush();
				expect(component.projectId).toBe('page-project');
				component.writeValue(null); // e.g. a client the page project does not belong to

				component.organizationContactId = null; // the client is cleared again
				await flush();

				expect(component.projectId).toBeNull();
			});

			it('is still the starting value when the first list fails to load and a reload succeeds', async () => {
				// ngOnInit asks twice (the organization arrives through two subscriptions): both fail.
				const unreachable = new Error('API unreachable');
				getAll.mockRejectedValueOnce(unreachable).mockRejectedValueOnce(unreachable);
				const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);

				try {
					component.ngOnInit();
					await flush();
					expect(component.projectId).toBeFalsy();

					component.organizationContactId = null; // any reload, e.g. a client picked and cleared
					await flush();

					expect(component.projectId).toBe('page-project');
				} finally {
					quiet.mockRestore();
				}
			});

			it('does not replace the project of the task being edited', async () => {
				component.writeValue('picked-project');

				component.ngOnInit();
				await flush();

				expect(component.projectId).toBe('picked-project');
			});
		});

		it("still drives the page's global selector, as before", async () => {
			component.ngOnInit();
			await flush();
			component.writeValue('picked-project');

			component.organizationContactId = 'client-acme';
			await flush();

			expect(component.projectId).toBe('page-project');
		});
	});
});
