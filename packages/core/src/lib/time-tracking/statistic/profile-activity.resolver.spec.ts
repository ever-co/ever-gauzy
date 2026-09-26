/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PARAM_ARGS_METADATA } from '@nestjs/graphql';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, TenantPermissionGuard } from '../../shared/guards';
import { ProfileActivityController } from './profile-activity.controller';
import { ProfileActivityResolver } from './profile-activity.resolver';

/**
 * The profile-activity summary over GraphQL.
 *
 * The delivered REST surface is one `GET /timesheet/statistics/profile-activity`, served by a second
 * controller under the same path as the statistics routes. This suite pins what makes that second
 * controller a second resolver, and what is easy to get quietly wrong about it:
 *
 * - the capability is one root field of the one composed schema, and it is a computed answer rather
 *   than a resource — no connection, no node field, no count field and no mutation, because the
 *   controller serves no `GET /:id`, no `GET /count` and no write;
 * - the field reaches the same `StatisticService.getProfileActivity` method its route reaches, with
 *   the same request, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and the permission is the absence the controller states**:
 *   `ProfileActivityController` carries `TenantPermissionGuard` and no `@Permissions` anywhere, so the
 *   resolver's class carries that guard beside the gate, and neither its class nor its one field states
 *   a permission. That parity is asserted rather than assumed, because a resolver that demanded a
 *   permission would refuse a caller the REST route serves;
 * - the period is a half-open span of local calendar days stated as date-only strings, which is the
 *   shape the delivered read accepts and the reason the two arguments are not the kernel's `DateTime`;
 * - the per-day breakdown is answered only when the caller asks for it, so the member is declared
 *   nullable rather than as an always-present list;
 * - **the gate holds**: a switched-off `FEATURE_GRAPHQL` refuses the field with the query protocol's
 *   own 404, and a switched-on one serves it.
 */

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const TEAM = '00000000-0000-4000-8000-000000000006';

const START_DATE = '2026-08-01';
const END_DATE = '2026-09-01';
const TIME_ZONE = 'Europe/Madrid';

/** What the delivered read answers: two active local days, their total, and the per-day breakdown. */
const ACTIVITY = {
	employeeId: EMPLOYEE,
	activeDays: 2,
	totalDuration: 900.3,
	firstActiveOn: '2026-08-03',
	lastActiveOn: '2026-08-19',
	period: { startDate: START_DATE, endDate: END_DATE, timeZone: TIME_ZONE },
	daily: [
		{ date: '2026-08-03', duration: 300.1 },
		{ date: '2026-08-19', duration: 600.2 }
	]
};

/** The resolver, over a scripted service. */
function surfaces() {
	const statisticService = { getProfileActivity: jest.fn().mockResolvedValue(ACTIVITY) };

	return {
		statisticService,
		resolver: new ProfileActivityResolver(statisticService as never)
	};
}

/**
 * The composed schema, as text: this domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..', '..');
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The type one root field answers with, as the schema states it. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: { toString(): string } }> }
		| undefined;

	return root?.getFields()?.[field]?.type.toString() ?? '';
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The description printed above one member, which is where a member's unit is stated. */
function descriptionOf(typeName: string, member: string): string {
	const match = new RegExp(`"""([\\s\\S]*?)"""\\s*\\n\\s*${member}\\b`).exec(typeBody(typeName));

	return match?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ProfileActivityController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The fields of one resolver, as functions. */
function fieldsOf(resolver: typeof ProfileActivityResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ProfileActivityController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ProfileActivityController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, read the way the guard reads it. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(ProfileActivityResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, ProfileActivityResolver)
	);
}

/** The guards one resolver field runs under, as a copy of the class's own chain. */
function guardsOfField(field: string): unknown[] {
	// Copied rather than handed back: the field states no guards of its own and runs under the class's
	// array, and a caller that sorts what it was given would reorder the resolver's own metadata.
	return [
		...(Reflect.getMetadata('__guards__', fieldsOf(ProfileActivityResolver)[field]) ??
			Reflect.getMetadata('__guards__', ProfileActivityResolver) ??
			[])
	];
}

/**
 * The argument names the field binds, as the resolver's own parameter metadata states them.
 *
 * Read from the metadata rather than from the method signature, because the signature's names are not
 * what the runtime binds: an `@Args` name that disagreed with the schema's would leave the parameter
 * undefined with nothing failing anywhere, so the two readings are compared below.
 */
function boundArgs(field: string): string[] {
	const metadata = (Reflect.getMetadata(PARAM_ARGS_METADATA, ProfileActivityResolver, field) ?? {}) as Record<
		string,
		{ data?: string }
	>;

	return Object.values(metadata)
		.map((argument) => argument?.data)
		.filter((name): name is string => Boolean(name))
		.sort();
}

describe('ProfileActivityResolver — the SDL declares the one capability the REST route serves', () => {
	it('declares its root field, and answers the type declared for it', () => {
		expect(rootFields('Query')).toContain('timeTrackingProfileActivity');
		expect(fieldType('Query', 'timeTrackingProfileActivity')).toBe('ProfileActivity!');
	});

	it('declares no write, no connection, no node field and no count field', () => {
		// The controller serves one `GET` and nothing else, so nothing here mirrors a write — and a
		// summary has no identifier to read one by, which is why there is no node field either.
		expect(rootFields('Mutation')).not.toContain('timeTrackingProfileActivity');
		expect(rootFields('Mutation').filter((field) => field.startsWith('profileActivity'))).toEqual([]);
		expect(printed).not.toMatch(/type ProfileActivityConnection/);
		expect(rootFields('Query')).not.toContain('profileActivity');
		expect(rootFields('Query')).not.toContain('profileActivityCount');
	});

	it('states the period as local calendar dates, which is what the delivered read accepts', () => {
		expect(fieldArgs('Query', 'timeTrackingProfileActivity')).toEqual([
			'organizationId',
			'employeeId',
			'startDate',
			'endDate',
			'timeZone',
			'organizationTeamId',
			'includeDaily'
		]);

		// Date-only strings, not the kernel's `DateTime`: the read resolves the two days against
		// `timeZone` and refuses an instant, so offering one would be offering a value it rejects.
		expect(printed).toMatch(/startDate: String!/);
		expect(printed).toMatch(/endDate: String!/);
		expect(printed).toMatch(/timeZone: String!/);
		expect(printed).not.toMatch(/timeTrackingProfileActivity\([^)]*startDate: DateTime/);
	});

	it('binds every argument the SDL declares', () => {
		expect(boundArgs('timeTrackingProfileActivity')).toEqual(
			[...fieldArgs('Query', 'timeTrackingProfileActivity')].sort()
		);
	});

	it('declares the summary with the members the delivered read fills', () => {
		const body = typeBody('ProfileActivity');

		expect(body).toMatch(/employeeId: ID!/);
		expect(body).toMatch(/activeDays: Int!/);
		expect(body).toMatch(/totalDuration: Float!/);
		expect(body).toMatch(/firstActiveOn: String/);
		expect(body).toMatch(/lastActiveOn: String/);
		expect(body).toMatch(/period: ProfileActivityPeriod!/);
		// The breakdown is answered only when the caller asks for it, so the member is nullable rather
		// than an always-present list the read would have to fabricate.
		expect(body).toMatch(/daily: \[ProfileActivityDay!\]/);
		expect(body).not.toContain('daily: [ProfileActivityDay!]!');
	});

	it('declares the local days as labels rather than instants, and the durations in seconds', () => {
		expect(typeBody('ProfileActivityDay')).toMatch(/date: String!/);
		expect(descriptionOf('ProfileActivityDay', 'duration')).toContain('Seconds');
		expect(descriptionOf('ProfileActivity', 'totalDuration')).toContain('Seconds');
		expect(typeBody('ProfileActivityPeriod')).toMatch(/timeZone: String!/);
	});

	it('declares no money, because the answer is time rather than an amount', () => {
		expect(printed).not.toMatch(/type ProfileActivity[^}]*Decimal/);
	});
});

describe('ProfileActivityResolver — one concept, two protocols, the same operation', () => {
	it('reads the summary through the same service method the REST route calls', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingProfileActivity(
			ORGANIZATION,
			EMPLOYEE,
			START_DATE,
			END_DATE,
			TIME_ZONE,
			TEAM,
			true
		);

		expect(answer).toBe(ACTIVITY);
		expect(statisticService.getProfileActivity).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			startDate: START_DATE,
			endDate: END_DATE,
			timeZone: TIME_ZONE,
			organizationTeamId: TEAM,
			includeDaily: true
		});
	});

	it('substitutes no default of its own: an omitted breakdown stays omitted', async () => {
		const { resolver, statisticService } = surfaces();

		await resolver.timeTrackingProfileActivity(ORGANIZATION, EMPLOYEE, START_DATE, END_DATE, TIME_ZONE);
		const request = statisticService.getProfileActivity.mock.calls[0][0];

		// The delivered read answers the breakdown only for exactly `true`, and the route's own default
		// is `false`; passing anything else here would be a second statement of that default.
		expect(request.includeDaily).toBeUndefined();
		expect(request.organizationTeamId).toBeUndefined();
	});

	it('lets a refusal travel unchanged, which is how a caller that may not view the profile is answered', async () => {
		const { resolver, statisticService } = surfaces();
		const refusal = new Error('Forbidden');
		statisticService.getProfileActivity.mockRejectedValueOnce(refusal);

		await expect(
			resolver.timeTrackingProfileActivity(ORGANIZATION, EMPLOYEE, START_DATE, END_DATE, TIME_ZONE)
		).rejects.toBe(refusal);
	});
});

describe('ProfileActivityResolver — the guard chain is the controller’s and the permission is its absence', () => {
	it('states on the class the guard the controller states, with the gate appended and nothing else', () => {
		// The controller's own guard, then the gate: the gate reads the request's tenant and
		// organization to resolve the capability, so it must not run before the guard that establishes
		// them — and nothing else may narrow a route that states no permission.
		expect(Reflect.getMetadata('__guards__', ProfileActivityController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', ProfileActivityResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('mirrors the one route it serves, guard for guard', () => {
		const field = 'timeTrackingProfileActivity';

		expect(typeof handlersOf(ProfileActivityController)['getProfileActivity']).toBe('function');
		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(ProfileActivityController, 'getProfileActivity'), FeatureFlagGuard].sort()
		);
	});

	it('states no permission anywhere, because the controller states none', () => {
		const field = 'timeTrackingProfileActivity';

		// The controller's own metadata: nothing on the class, nothing on the handler — which is what
		// the REST route runs under, and therefore what this surface has to run under too.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProfileActivityController)).toBeUndefined();
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(ProfileActivityController)['getProfileActivity'])
		).toBeUndefined();
		expect(permissionOfRoute(ProfileActivityController, 'getProfileActivity')).toBeUndefined();

		// And the resolver's: the same absence, on the class and on the field. A resolver that demanded
		// a permission would refuse a caller the REST route serves — the narrowing this delivery exists
		// to prevent — so the absence is the parity and is asserted as one.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ProfileActivityResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(ProfileActivityResolver)[field])).toBeUndefined();
		expect(permissionOfField(field)).toBeUndefined();
	});

	it('carries the gate on the class, beside the controller’s own guard and in that order', () => {
		const stated = Reflect.getMetadata('__guards__', ProfileActivityResolver) ?? [];

		expect(stated).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
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
		getHandler: () => (ProfileActivityResolver.prototype as never)[field],
		getClass: () => ProfileActivityResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ProfileActivityResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so the field is behind it — a field that states no permission is still gated.
		expect(Reflect.getMetadata(FEATURE_METADATA, ProfileActivityResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ProfileActivityResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses the field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('timeTrackingProfileActivity'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timeTrackingProfileActivity');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('timeTrackingProfileActivity'))).resolves.toBe(true);
	});
});
