import '../../core/entities/internal';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { PermissionGuard } from '../../shared/guards';
import { ProjectManagerOrPermissionGuard } from './project-manager-or-permission.guard';

/**
 * The project manager's way in, over both protocols.
 *
 * The guard admits the employee who manages the project a request acts on before the role's grant is consulted,
 * and otherwise is the permission guard. Over REST the project is the `:id` of the path. Over GraphQL there is no
 * path: the project is the field's `id` argument, or the `id` of `updateOrganizationProject`'s input. Reading only
 * the path made every GraphQL project mutation refuse a manager without the role's permission, although the same
 * change over REST was allowed.
 */

const EMPLOYEE = 'employee-1';
const PROJECT = '11111111-1111-4111-8111-111111111111';

class OrganizationProjectResolver {}
function handler() {}

function httpContext(params: Record<string, unknown>): ExecutionContext {
	const request = { params };
	const positions = [request, {}, undefined];
	return {
		getType: () => 'http',
		getClass: () => OrganizationProjectResolver,
		getHandler: () => handler,
		getArgs: () => positions,
		getArgByIndex: (index: number) => positions[index],
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined })
	} as unknown as ExecutionContext;
}

/** The four positions `GqlExecutionContext` reads: root, the field's arguments, the context, the field info. */
function graphqlContext(
	args: Record<string, unknown>,
	info: unknown = undefined,
	target: Function = OrganizationProjectResolver
): ExecutionContext {
	const positions = [{}, args, { req: { params: {} } }, info];
	return {
		getType: () => 'graphql',
		getClass: () => target,
		getHandler: () => handler,
		getArgs: () => positions,
		getArgByIndex: (index: number) => positions[index],
		switchToHttp: () => {
			throw new Error('a GraphQL operation has no HTTP surface');
		}
	} as unknown as ExecutionContext;
}

function buildGuard(managerOf: string[] = [PROJECT]) {
	const projectService = { isManagerOfProject: jest.fn(async (projectId: string) => managerOf.includes(projectId)) };
	const guard = new ProjectManagerOrPermissionGuard({} as any, {} as any, {} as any, projectService as any);
	jest.spyOn(guard as any, 'oauthAppScopesReachRoute').mockReturnValue(true);
	const permission = jest.spyOn(PermissionGuard.prototype, 'canActivate').mockResolvedValue(false);
	return { guard, projectService, permission };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('ProjectManagerOrPermissionGuard', () => {
	it('admits the manager of the project named in the REST path', async () => {
		const { guard, projectService, permission } = buildGuard();

		await expect(guard.canActivate(httpContext({ id: PROJECT }))).resolves.toBe(true);

		expect(projectService.isManagerOfProject).toHaveBeenCalledWith(PROJECT, EMPLOYEE);
		expect(permission).not.toHaveBeenCalled();
	});

	it.each([
		['the id argument (archive, delete, setting, task view, one project)', { id: PROJECT }],
		['the id of updateOrganizationProject’s input', { input: { id: PROJECT, name: 'Renamed' } }]
	])('admits the manager of the project named by %s over GraphQL', async (_case, args) => {
		const { guard, projectService, permission } = buildGuard();

		await expect(guard.canActivate(graphqlContext(args))).resolves.toBe(true);

		expect(projectService.isManagerOfProject).toHaveBeenCalledWith(PROJECT, EMPLOYEE);
		expect(permission).not.toHaveBeenCalled();
	});

	it('defers to the permission guard for an employee who does not manage the project', async () => {
		const { guard, permission } = buildGuard([]);

		await expect(guard.canActivate(graphqlContext({ id: PROJECT }))).resolves.toBe(false);

		expect(permission).toHaveBeenCalledTimes(1);
	});

	it.each([
		['createOrganizationProject (its input names no project)', { input: { name: 'New' } }],
		['the lists', { filter: { id: { eq: PROJECT } }, first: 10 }],
		['isOrganizationProjectManager, whose project is a projectId', { projectId: PROJECT, employeeId: EMPLOYEE }],
		['an id that is not a string', { id: [PROJECT] }],
		['an id that is not a UUID, which the manager lookup would answer with a database error', { id: 'not-a-uuid' }]
	])('takes no manager short-circuit for %s', async (_case, args) => {
		const { guard, projectService, permission } = buildGuard();

		await expect(guard.canActivate(graphqlContext(args))).resolves.toBe(false);

		expect(projectService.isManagerOfProject).not.toHaveBeenCalled();
		expect(permission).toHaveBeenCalledTimes(1);
	});

	it('takes no manager short-circuit for a REST :id that is not a UUID', async () => {
		const { guard, projectService, permission } = buildGuard();

		await expect(guard.canActivate(httpContext({ id: 'not-a-uuid' }))).resolves.toBe(false);

		expect(projectService.isManagerOfProject).not.toHaveBeenCalled();
		expect(permission).toHaveBeenCalledTimes(1);
	});

	it('takes no manager short-circuit for a REST route without :id', async () => {
		const { guard, projectService, permission } = buildGuard();

		await expect(guard.canActivate(httpContext({}))).resolves.toBe(false);

		expect(projectService.isManagerOfProject).not.toHaveBeenCalled();
		expect(permission).toHaveBeenCalledTimes(1);
	});

	it('lets a third-party app in through its user’s management only when its scopes reach the route', async () => {
		const { guard, projectService, permission } = buildGuard();
		(guard as any).oauthAppScopesReachRoute.mockReturnValue(false);

		await expect(guard.canActivate(graphqlContext({ id: PROJECT }))).resolves.toBe(false);

		expect(projectService.isManagerOfProject).not.toHaveBeenCalled();
		expect(permission).toHaveBeenCalledTimes(1);
	});
	describe('with the real OAuth-app scope check', () => {
		/** The resolver's class-level edit pair, as `OrganizationProjectResolver` states it. */
		class ProjectResolver {}
		Reflect.defineMetadata(
			PERMISSIONS_METADATA,
			[PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT],
			ProjectResolver
		);
		const MUTATION = { operation: { operation: 'mutation' } };

		function buildGuardWithRealScopes() {
			const projectService = { isManagerOfProject: jest.fn(async () => true) };
			const guard = new ProjectManagerOrPermissionGuard(
				{} as any,
				new Reflector(),
				{} as any,
				projectService as any
			);
			const permission = jest.spyOn(PermissionGuard.prototype, 'canActivate').mockResolvedValue(false);
			return { guard, projectService, permission };
		}

		it('admits a first-party manager on a GraphQL mutation', async () => {
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as any);
			const { guard, projectService, permission } = buildGuardWithRealScopes();

			await expect(guard.canActivate(graphqlContext({ id: PROJECT }, MUTATION, ProjectResolver))).resolves.toBe(
				true
			);

			expect(projectService.isManagerOfProject).toHaveBeenCalledWith(PROJECT, EMPLOYEE);
			expect(permission).not.toHaveBeenCalled();
		});

		it('never hands a GraphQL mutation to a read-only third-party app through its user’s management', async () => {
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: 'user-1',
				oauthApp: { scopes: ['zap'] }
			} as any);
			const { guard, projectService, permission } = buildGuardWithRealScopes();

			await expect(guard.canActivate(graphqlContext({ id: PROJECT }, MUTATION, ProjectResolver))).resolves.toBe(
				false
			);

			expect(projectService.isManagerOfProject).not.toHaveBeenCalled();
			expect(permission).toHaveBeenCalledTimes(1);
		});
	});
});
