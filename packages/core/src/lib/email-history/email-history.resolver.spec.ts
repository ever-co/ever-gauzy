/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { EmailStatusEnum, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmailHistoryController } from './email-history.controller';
import { EmailHistoryResolver } from './email-history.resolver';
import { EmailHistoryResendCommand } from './commands';

/**
 * The sent-message ledger over GraphQL.
 *
 * The delivered REST routes answer the list of what was sent, edit one row and send one again. This
 * suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - the two capabilities are root fields of the one composed schema, and the list is a connection with
 *   the platform's own cursor codec behind it, so a cursor obtained over REST resumes here and a refusal
 *   is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission are the controller's**, on the resend field as well, whose route
 *   restates the two guards and states no permission of its own;
 * - **no node read and no count are declared**, because the controller serves neither: a capability
 *   GraphQL has and REST does not is the asymmetry the two-protocol rule forbids;
 * - the two relations the delivered read loads differently on its two ORM branches are not members.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SENT = '00000000-0000-4000-8000-000000000010';
const FAILED = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted reader answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: SENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Welcome to the platform',
		content: '<html><body>Welcome</body></html>',
		email: 'first@example.org',
		status: EmailStatusEnum.SENT,
		userId: '00000000-0000-4000-8000-000000000020',
		emailTemplateId: '00000000-0000-4000-8000-000000000030',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FAILED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Invoice 41',
		content: '<html><body>Invoice</body></html>',
		email: 'second@example.org',
		status: EmailStatusEnum.FAILED,
		userId: null,
		emailTemplateId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const emailHistoryService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		update: jest.fn().mockResolvedValue(ROWS[0]),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		emailHistoryService,
		commandBus,
		resolver: new EmailHistoryResolver(emailHistoryService as never, commandBus as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		// The plural is not the singular with a suffix — `emailHistories` does not contain `emailHistory` —
		// so the domain's fields are the ones that share the stem of the concept's name.
		.filter((field) => field.toLowerCase().includes('emailhistor'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input object, so a member no filter declares can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmailHistoryController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmailHistoryController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmailHistoryController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = EmailHistoryResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under: the class's chain plus whatever the field restates. */
function guardsOfField(field: string): unknown[] {
	const fields = EmailHistoryResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', EmailHistoryResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmailHistoryResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the list query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['emailHistories']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['updateEmailHistory', 'resendEmailHistory'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['emailHistories']);
		expect(ownedRootFields('Mutation')).toEqual(['resendEmailHistory', 'updateEmailHistory']);
	});

	it('declares no node read and no count, because the controller serves neither', () => {
		// The delivered resource answers its rows as a list; a node field here would be a capability REST
		// does not have. A count is the same asymmetry.
		expect(printed).not.toMatch(/\bemailHistory\(/);
		expect(printed).not.toMatch(/emailHistoryCount/);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmailHistoryConnection \{\s*nodes: \[EmailHistory!\]!\s*edges: \[EmailHistoryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmailHistoryEdge \{\s*node: EmailHistory!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmailHistoryFilter \{/);
		expect(printed).toMatch(/input EmailHistorySort \{/);
		expect(printed).toMatch(
			/enum EmailHistorySortField \{\s*createdAt\s*updatedAt\s*name\s*email\s*status\s*\}/
		);
	});

	it('carries the delivered columns, and not the relations the two ORM branches load differently', () => {
		const body = typeBody('EmailHistory');

		expect(body).toMatch(/email: String!/);
		expect(body).toMatch(/content: String/);
		expect(body).toMatch(/status: String/);
		// The relations are loaded in full on one branch, joined without their columns on the other, so a
		// member for either would be present or absent depending on the installation.
		expect(body).not.toMatch(/\buser: User/);
		expect(body).not.toMatch(/\bemailTemplate: EmailTemplate/);
		expect(body).toMatch(/userId: ID/);
		expect(body).toMatch(/emailTemplateId: ID/);
		// No delivered route withdraws a message, so the marker is null on every row this surface answers.
		expect(body).not.toContain('deletedAt');
	});

	it('offers no argument it cannot honour', () => {
		// The delivered read narrows to the live, unarchived rows itself, so neither column is filterable.
		expect(inputBody('EmailHistoryFilter')).not.toMatch(/\b(isActive|isArchived):/);
		// The rendered body is not a filter and not a sort key: it is a document column.
		expect(inputBody('EmailHistoryFilter')).not.toMatch(/\bcontent:/);
		expect(printed).toMatch(
			/enum EmailHistorySortField \{\s*createdAt\s*updatedAt\s*name\s*email\s*status\s*\}/
		);
	});
});

describe('EmailHistoryResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, emailHistoryService } = surfaces();

		const connection = await resolver.emailHistories(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, through the same service method.
		expect(emailHistoryService.findAll).toHaveBeenCalledWith({ where: {} });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SENT);
	});

	it('keeps the ledger’s own order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.emailHistories();

		expect(connection.nodes.map((node) => node.id)).toEqual([SENT, FAILED]);
	});

	it('narrows by the fields the filter declares, which is how one message is read back', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.emailHistories({ status: { eq: 'FAILED' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([FAILED]);

		const byRecipient = await resolver.emailHistories({ email: { eq: 'first@example.org' } });
		expect(byRecipient.nodes.map((node) => node.id)).toEqual([SENT]);

		const byId = await resolver.emailHistories({ id: { eq: FAILED } });
		expect(byId.nodes.map((node) => node.id)).toEqual([FAILED]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byEmail = await resolver.emailHistories(undefined, [{ field: 'email', direction: 'ASC' }]);
		expect(byEmail.nodes.map((node) => node.id)).toEqual([SENT, FAILED]);

		const byCreated = await resolver.emailHistories(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([FAILED, SENT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.emailHistories(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SENT]);

		const second = await resolver.emailHistories(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FAILED]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.emailHistories(undefined, undefined, undefined, 20);

		const last = await resolver.emailHistories(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SENT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.emailHistories(undefined, [{ field: 'content', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.emailHistories({ isArchived: { eq: false } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.emailHistories(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmailHistoryResolver — one concept, two protocols, the same operations', () => {
	it('changes a message through the same service method the REST route calls, and reads it back', async () => {
		const { resolver, emailHistoryService } = surfaces();

		const answer = await resolver.updateEmailHistory({ id: SENT, isArchived: true });

		expect(emailHistoryService.update).toHaveBeenCalledWith(SENT, { isArchived: true });
		// The delivered route answers either the row or the store's own update result, so the row the
		// write produced is read back through the service's own node read.
		expect(emailHistoryService.findOneByIdString).toHaveBeenCalledWith(SENT);
		expect(answer).toBe(ROWS[0]);
	});

	it('resends a message through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.resendEmailHistory(SENT, { organizationId: ORGANIZATION });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmailHistoryResendCommand);
		expect(command.id).toBe(SENT);
		expect(command.input).toEqual({ organizationId: ORGANIZATION });
		// The language is the one the delivered route reads off the `language` header, whose default is
		// English when the request names none.
		expect(command.languageCode).toBe(LanguagesEnum.ENGLISH);
	});

	it('resends without an organization when the caller states none, which is the delivered body’s own default', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.resendEmailHistory(SENT);

		expect(commandBus.execute.mock.calls[0][0].input).toEqual({ organizationId: undefined });
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('Error while re-sending mail: the transport refused the message.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.resendEmailHistory(SENT, { organizationId: ORGANIZATION })).rejects.toBe(refusal);
	});

	it('answers a message that is not there with the service’s own miss', async () => {
		const { resolver, emailHistoryService } = surfaces();
		emailHistoryService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateEmailHistory({ id: FAILED })).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EmailHistoryResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EmailHistoryResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EmailHistoryController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const routes: Array<[string, string]> = [
			['emailHistories', 'findAll'],
			['updateEmailHistory', 'update'],
			['resendEmailHistory', 'resendInvite']
		];

		for (const [field, handler] of routes) {
			// The controller's chain plus the gate is the field's own chain, which is the whole parity
			// claim: the resend restates the two guards beside the class that already carries them, which
			// is the one route where the two lists differ in length and not in scope.
			expect([...guardsOfRoute(EmailHistoryController, handler), FeatureFlagGuard].sort()).toEqual(
				[...guardsOfField(field)].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmailHistoryResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmailHistoryController)
		);
		expect(permissionOfField('emailHistories')).toEqual([PermissionsEnum.VIEW_ALL_EMAILS]);
	});

	it('states on every field the permission its own route runs under, the resend included', () => {
		const routes: Array<[string, string]> = [
			['emailHistories', 'findAll'],
			['updateEmailHistory', 'update'],
			['resendEmailHistory', 'resendInvite']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(EmailHistoryController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the class permission on the resend, because its route states only the guards', () => {
		// The resend handler restates the two guards and states no permission, so it runs under the
		// controller’s class-level permission — and so does the field that mirrors it.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmailHistoryController)['resendInvite'])).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', handlersOf(EmailHistoryController)['resendInvite'])).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(permissionOfField('resendEmailHistory')).toEqual([PermissionsEnum.VIEW_ALL_EMAILS]);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (EmailHistoryResolver.prototype as never)[field],
		getClass: () => EmailHistoryResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmailHistoryResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, EmailHistoryResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmailHistoryResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('emailHistories')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('emailHistories');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('emailHistories'))).resolves.toBe(true);
	});
});
