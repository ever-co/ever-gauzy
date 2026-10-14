/**
 * 🛑 These two imports must stay FIRST, before anything that pulls a core controller — see the note at the top
 * of `mutating-route-permissions.spec.ts`: entering the entity graph from a controller leaves a decorator module
 * half-initialized.
 */
import 'reflect-metadata';
import '../../core/entities/internal';
import * as fs from 'fs';
import * as path from 'path';
import { HttpStatus, RequestMethod } from '@nestjs/common';
import { RESOLVER_NAME_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { Kind, ObjectTypeExtensionNode, parse, print } from 'graphql';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CrudController } from '../../core/crud';
import { AddressRoleController } from '../../address-role/address-role.controller';
import { ChannelController } from '../../channel/channel.controller';
import { ChannelDomainController } from '../../channel-domain/channel-domain.controller';
import { DashboardController } from '../../dashboard/dashboard.controller';
import { DashboardWidgetController } from '../../dashboard/dashboard-widget/dashboard-widget.controller';
import { PaymentTermController } from '../../payment-term/payment-term.controller';
import { RegionController } from '../../region/region.controller';
import { UnitController } from '../../measurement/unit.controller';
import { UnitCategoryController } from '../../measurement/unit-category.controller';
import { AddressRoleResolver } from '../../address-role/address-role.resolver';
import { ChannelResolver } from '../../channel/channel.resolver';
import { ChannelDomainResolver } from '../../channel-domain/channel-domain.resolver';
import { DashboardResolver } from '../../dashboard/dashboard.resolver';
import { DashboardWidgetResolver } from '../../dashboard/dashboard-widget/dashboard-widget.resolver';
import { PaymentTermResolver } from '../../payment-term/payment-term.resolver';
import { RegionResolver } from '../../region/region.resolver';
import { UnitResolver } from '../../measurement/unit.resolver';
import { UnitCategoryResolver } from '../../measurement/unit-category.resolver';
import { PermissionGuard } from './permission.guard';

/**
 * Owner decision 5 (2026-10-13), "Require edit permission": the soft-delete/recover pair a controller inherits
 * from `CrudController` requires the controller's own edit grant — the one its `update` route states.
 *
 * `CrudController` declares `DELETE :id/soft` and `PUT :id/recover` with no permission metadata, and
 * `PermissionGuard` resolves handler-then-class, so on the controllers below — each of which states a write
 * grant on `update` but left the pair inherited — the pair stood on the class-level READ grant: a role that may
 * only look at channels, regions, units, payment terms, address roles or dashboards could withdraw and restore
 * them (§7.65 item 2 of the platform-extensions record named eight of them; `Dashboard` and `DashboardWidget`
 * were found by measuring every CRUD controller rather than reading the audit's printed sample).
 *
 * The grant is read back from each controller's own `update` handler rather than copied into this file, so the
 * suite holds the rule — "the pair requires what `update` requires" — rather than a list of strings that could
 * drift from it. `mutating-route-permission-check.mjs` holds the same rule statically for every controller.
 */
const CONTROLLERS: ReadonlyArray<Function> = [
	AddressRoleController,
	ChannelController,
	ChannelDomainController,
	DashboardController,
	DashboardWidgetController,
	PaymentTermController,
	RegionController,
	UnitController,
	UnitCategoryController
];

/** The two routes, by handler name, with the method, the path and the service call each must keep. */
const PAIR: ReadonlyArray<{ handler: 'softRemove' | 'softRecover'; method: RequestMethod; path: string }> = [
	{ handler: 'softRemove', method: RequestMethod.DELETE, path: ':id/soft' },
	{ handler: 'softRecover', method: RequestMethod.PUT, path: ':id/recover' }
];

/** What `PermissionGuard` resolves for a handler: the handler's metadata, else the class's. */
function effectiveGrant(controller: Function, handler: string): string[] {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (controller.prototype as any)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller) ??
		[]
	);
}

const isReadGrant = (grant: string) => /(?:^|_)(?:VIEW|READ)(?:_|$)/.test(grant);

describe('the soft-delete/recover pair requires the edit grant its update route states (owner decision 5)', () => {
	it.each(CONTROLLERS.map((controller) => [controller.name, controller]))(
		'%s states its update route’s grant on both routes, behind a guard that reads it',
		(_name, controller) => {
			const update = effectiveGrant(controller as Function, 'update');

			// The control: update states a write grant, and the class-level grant the inherited pair used to
			// stand on is a read grant that differs from it.
			expect(update.length).toBeGreaterThan(0);
			expect(update.some((grant) => !isReadGrant(grant))).toBe(true);
			const classGrant: string[] = Reflect.getMetadata(PERMISSIONS_METADATA, controller as Function) ?? [];
			expect(classGrant.every(isReadGrant)).toBe(true);

			const classGuards: Function[] = Reflect.getMetadata(GUARDS_METADATA, controller as Function) ?? [];

			for (const { handler, method, path } of PAIR) {
				const route = ((controller as Function).prototype as any)[handler];

				// The override is the controller's own, so the metadata is not the shared base handler's.
				expect(Object.prototype.hasOwnProperty.call((controller as Function).prototype, handler)).toBe(true);
				expect(effectiveGrant(controller as Function, handler)).toEqual(update);
				expect([...classGuards, ...(Reflect.getMetadata(GUARDS_METADATA, route) ?? [])]).toContain(PermissionGuard);

				// Who may call it is the only change: the method, the path and the status are the base route's.
				expect(Reflect.getMetadata(METHOD_METADATA, route)).toBe(method);
				expect(Reflect.getMetadata(PATH_METADATA, route)).toBe(path);
				expect(Reflect.getMetadata(HTTP_CODE_METADATA, route)).toBe(HttpStatus.ACCEPTED);
				expect(Reflect.getMetadata(HTTP_CODE_METADATA, (CrudController.prototype as any)[handler])).toBe(
					HttpStatus.ACCEPTED
				);
			}
		}
	);

	it.each(CONTROLLERS.map((controller) => [controller.name, controller]))(
		'%s reaches the service method the inherited route reached, with the same arguments',
		async (_name, controller) => {
			for (const { handler } of PAIR) {
				const crudService = { [handler]: jest.fn().mockResolvedValue({ id: 'row-1' }) };
				const instance = Object.create((controller as Function).prototype);
				Object.defineProperty(instance, 'crudService', { value: crudService });

				await expect(instance[handler]('row-1')).resolves.toEqual({ id: 'row-1' });
				// The base route hands the service the id and its (empty) rest parameter.
				expect(crudService[handler]).toHaveBeenCalledWith('row-1', []);
			}
		}
	);
});

/**
 * §3.1 parity: GraphQL is never wider nor narrower than REST. Each resource's `softDelete<T>` / `recover<T>`
 * fields state exactly the grant their route states — read back from the controller, not copied — and reach the
 * service method the route reaches. Seven of the nine had no GraphQL pair at all (`graphql-write-parity-check.mjs`
 * requires one as soon as a controller overrides the pair); the two dashboard ones mirrored the read grant.
 */
const SURFACES: ReadonlyArray<{ type: string; controller: Function; resolver: Function; service: string; sdl: string }> = [
	{ type: 'AddressRole', controller: AddressRoleController, resolver: AddressRoleResolver, service: 'addressRoleService', sdl: 'address-role/schema/address-role.api.gql' },
	{ type: 'Channel', controller: ChannelController, resolver: ChannelResolver, service: 'channelService', sdl: 'channel/schema/channel.api.gql' },
	{ type: 'ChannelDomain', controller: ChannelDomainController, resolver: ChannelDomainResolver, service: 'channelDomainService', sdl: 'channel-domain/schema/channel-domain.api.gql' },
	{ type: 'Dashboard', controller: DashboardController, resolver: DashboardResolver, service: 'dashboardService', sdl: 'dashboard/schema/dashboard.api.gql' },
	{ type: 'DashboardWidget', controller: DashboardWidgetController, resolver: DashboardWidgetResolver, service: 'dashboardWidgetService', sdl: 'dashboard/dashboard-widget/schema/dashboard-widget.api.gql' },
	{ type: 'PaymentTerm', controller: PaymentTermController, resolver: PaymentTermResolver, service: 'paymentTermService', sdl: 'payment-term/schema/payment-term.api.gql' },
	{ type: 'Region', controller: RegionController, resolver: RegionResolver, service: 'regionService', sdl: 'region/schema/region.api.gql' },
	{ type: 'Unit', controller: UnitController, resolver: UnitResolver, service: 'unitService', sdl: 'measurement/schema/measurement.api.gql' },
	{ type: 'UnitCategory', controller: UnitCategoryController, resolver: UnitCategoryResolver, service: 'unitCategoryService', sdl: 'measurement/schema/measurement.api.gql' }
];

/** The `Mutation` fields a domain's SDL declares, as `name(args): Type`. */
function declaredMutations(sdlFile: string): Map<string, string> {
	const document = parse(fs.readFileSync(path.join(__dirname, '../..', sdlFile), 'utf8'));
	const fields = new Map<string, string>();
	for (const definition of document.definitions) {
		if (definition.kind === Kind.OBJECT_TYPE_EXTENSION && definition.name.value === 'Mutation') {
			for (const field of (definition as ObjectTypeExtensionNode).fields ?? []) {
				const args = (field.arguments ?? []).map((arg) => `${arg.name.value}: ${print(arg.type)}`).join(', ');
				fields.set(field.name.value, `(${args}): ${print(field.type)}`);
			}
		}
	}
	return fields;
}

describe('the soft-delete/recover pair over GraphQL states its route’s grant and reaches its route’s service call', () => {
	it.each(SURFACES.map((surface) => [surface.type, surface]))('%s', async (type, surface) => {
		const declared = declaredMutations(surface.sdl);
		const guards: Function[] = Reflect.getMetadata(GUARDS_METADATA, surface.resolver) ?? [];

		expect(guards).toContain(PermissionGuard);

		for (const [field, route, call] of [
			[`softDelete${type}`, 'softRemove', 'softRemove'],
			[`recover${type}`, 'softRecover', 'softRecover']
		]) {
			const handler = (surface.resolver.prototype as any)[field];

			expect(declared.get(field)).toBe(`(id: ID!): ${type}!`);
			expect(Reflect.getMetadata(RESOLVER_NAME_METADATA, handler)).toBe(field);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual(effectiveGrant(surface.controller, route));
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual(effectiveGrant(surface.controller, 'update'));

			const service = { [call]: jest.fn().mockResolvedValue({ id: 'row-1' }) };
			const instance = Object.create(surface.resolver.prototype);
			Object.defineProperty(instance, surface.service, { value: service });

			await expect(instance[field]('row-1')).resolves.toEqual({ id: 'row-1' });
			expect(service[call]).toHaveBeenCalledWith('row-1');
		}
	});
});
