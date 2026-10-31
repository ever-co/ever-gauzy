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
	let queryParams$: BehaviorSubject<Record<string, string>>;
	let component: ProjectSelectorComponent;

	beforeEach(() => {
		getAll = jest.fn();
		queryParams$ = new BehaviorSubject<Record<string, string>>({});
		component = new ProjectSelectorComponent(
			{ getAll, getAllByEmployee: jest.fn() } as unknown as OrganizationProjectsService,
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
