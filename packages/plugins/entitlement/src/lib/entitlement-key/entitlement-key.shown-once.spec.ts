/**
 * A licence key is shown once, at issue — on both surfaces (owner decision 9, 2026-10-13: "Shown once only").
 *
 * The specifications disagreed with each other: `11` §9.1 ("a key is shown once, at issue"), `02` §4.8 E4
 * ("never returned again after its single reveal"), `05` §19.3 (the plaintext "leaves the service exactly
 * once") and `13` §R-30 (a key "returned more than once" is the risk to manage) on one side; `05` §19.3's
 * `keyCiphertext` "so support can re-display it" and ADR-50's "read back where the format allows" on the other.
 * The owner chose the first reading. GraphQL already refused `revealEntitlementKey`, but REST still served
 * `POST /entitlement-keys/:id/reveal`, which decrypted the stored ciphertext and answered the plaintext a
 * second time — exactly what the decision rules out.
 *
 * Pinned here, so the decision cannot be undone quietly on either protocol:
 *
 * 1. the REST re-display route is **refused** (`410 ENTITLEMENT_KEY_SHOWN_ONCE`) and never reaches the
 *    decrypting service method — the route stays declared with its grant (no-removal rule: gated, not deleted);
 * 2. **no GraphQL root field** — query, mutation or subscription — reveals a key, and the `EntitlementKey`
 *    type carries no key material; the plaintext rides only on the three payloads whose call minted it;
 * 3. **no API route hard-deletes** a right, an activation or a licence key: each controller's `DELETE` routes
 *    are the two inherited ones, both retire the row through `softRemove`, and no source file of the plugin
 *    calls a hard delete (`05` §1.7: only a retention job deletes from these three tables).
 */
jest.mock('@gauzy/common', () => ({ FeatureFlag: () => () => undefined }));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: no controller here is mapped onto a Nest application. */
	const decorator = () => () => undefined;
	const permissions = jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator');

	/** The kernel's own delegations for the inherited lifecycle routes (`crud.controller.ts`). */
	class CrudController {
		constructor(protected readonly crudService: any) {}

		async delete(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.delete(id, options);
		}

		async softRemove(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRemove(id, options);
		}

		async softRecover(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRecover(id, options);
		}
	}

	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}
	}

	class TenantAwareCrudService extends CrudService {
		constructor(
			typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {
			super(typeOrmRepository);
		}
	}

	class BaseEntity {}

	return {
		FEATURE_GRAPHQL: jest.requireActual('@gauzy/core/src/lib/feature/graphql-feature.code').FEATURE_GRAPHQL,
		CrudController,
		CrudService,
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		Permissions: permissions.Permissions,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		EventBus: class {},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		UseValidationPipe: decorator,
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		ExportRedacted: decorator,
		BaseEvent: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		Idempotent: decorator,
		Versioned: decorator,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('../entitlement/entitlement.service', () => ({ EntitlementService: class EntitlementService {} }));
jest.mock('../entitlement-activation/entitlement-activation.service', () => ({
	EntitlementActivationService: class EntitlementActivationService {}
}));
jest.mock('./entitlement-key.service', () => ({ EntitlementKeyService: class EntitlementKeyService {} }));
jest.mock('../entitlement-check/entitlement-check.service', () => ({
	EntitlementCheckService: class EntitlementCheckService {}
}));

import { GoneException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FieldDefinitionNode, Kind } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { EntitlementPermissions } from '../entitlement.permissions';
import { EntitlementController } from '../entitlement/entitlement.controller';
import { EntitlementActivationController } from '../entitlement-activation/entitlement-activation.controller';
import { EntitlementKeyController } from './entitlement-key.controller';
import { schemaExtensions } from '../graphql/schema-extensions';

const ID = '00000000-0000-4000-8000-0000000000e9';

/** Every member of one type the plugin's document declares or extends, by the type's name. */
function fieldsOf(typeName: string): FieldDefinitionNode[] {
	return schemaExtensions.definitions.flatMap((definition: any) =>
		(definition.kind === Kind.OBJECT_TYPE_DEFINITION || definition.kind === Kind.OBJECT_TYPE_EXTENSION) &&
		definition.name.value === typeName
			? [...(definition.fields ?? [])]
			: []
	);
}

/** Every route handler a controller class serves, its own and the ones it inherits. */
function routesOf(controller: new (...args: any[]) => any): { name: string; method: number; path: string }[] {
	const routes: { name: string; method: number; path: string }[] = [];
	const seen = new Set<string>();

	for (let prototype = controller.prototype; prototype && prototype !== Object.prototype; ) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (name === 'constructor' || seen.has(name)) continue;
			const handler = Object.getOwnPropertyDescriptor(prototype, name)?.value;
			const path = typeof handler === 'function' ? Reflect.getMetadata(PATH_METADATA, handler) : undefined;
			if (path === undefined) continue;
			seen.add(name);
			routes.push({ name, method: Reflect.getMetadata(METHOD_METADATA, handler), path });
		}
		prototype = Object.getPrototypeOf(prototype);
	}

	return routes;
}

describe('a licence key is shown once, at issue (owner decision 9, 2026-10-13)', () => {
	describe('REST: POST /entitlement-keys/:id/reveal is refused', () => {
		it('answers 410 ENTITLEMENT_KEY_SHOWN_ONCE and never reaches the decrypting service method', async () => {
			const service = { reveal: jest.fn().mockResolvedValue('PLAINTEXT-KEY-0001') };
			const controller = new EntitlementKeyController(service as any);

			const answer = controller.reveal(ID as any);

			await expect(answer).rejects.toBeInstanceOf(GoneException);
			await expect(controller.reveal(ID as any)).rejects.toThrow(/ENTITLEMENT_KEY_SHOWN_ONCE/);
			// The refusal names the recovery path a holder who lost a key has: a replacement credential.
			await expect(controller.reveal(ID as any)).rejects.toThrow(/reissue/);
			expect(service.reveal).not.toHaveBeenCalled();
		});

		it('stays declared, at its path and under its issuing grant: gated, not removed', () => {
			const handler = EntitlementKeyController.prototype.reveal;

			expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':id/reveal');
			expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual([
				EntitlementPermissions.ENTITLEMENTS_GRANT
			]);
		});
	});

	describe('GraphQL: nothing reads a key back', () => {
		it.each(['Query', 'Mutation', 'Subscription'])('no %s field reveals a key', (root) => {
			const names = fieldsOf(root).map((field) => field.name.value);

			expect(names.filter((name) => /reveal/i.test(name))).toEqual([]);
			expect(names).not.toContain('revealEntitlementKey');
		});

		it('the EntitlementKey type carries no key material — only the prefix support identifies it by', () => {
			const members = fieldsOf('EntitlementKey').map((field) => field.name.value);

			expect(members).toContain('keyPrefix');
			for (const material of ['key', 'plaintext', 'plaintextKey', 'keyHash', 'keyDigest', 'keyCiphertext', 'ciphertext']) {
				expect(members).not.toContain(material);
			}
		});

		it('the plaintext rides only on the three payloads whose call minted it', () => {
			const payloadsWithPlaintext = schemaExtensions.definitions
				.filter(
					(definition: any) =>
						(definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
							definition.kind === Kind.OBJECT_TYPE_EXTENSION) &&
						(definition.fields ?? []).some((field: FieldDefinitionNode) => /plaintext/i.test(field.name.value))
				)
				.map((definition: any) => definition.name.value)
				.sort();

			expect(payloadsWithPlaintext).toEqual(
				['GrantEntitlementPayload', 'IssueEntitlementKeyPayload', 'ReissueEntitlementKeyPayload'].sort()
			);
		});
	});

	describe('no API route hard-deletes a right, an activation or a licence key', () => {
		const CONTROLLERS = [EntitlementController, EntitlementActivationController, EntitlementKeyController];

		it.each(CONTROLLERS)('%p declares exactly the two inherited DELETE routes', (controller) => {
			const deletes = routesOf(controller)
				.filter((route) => route.method === RequestMethod.DELETE)
				.map((route) => `${route.name} ${route.path}`)
				.sort();

			expect(deletes).toEqual(['delete :id', 'softRemove :id/soft']);
		});

		it.each(CONTROLLERS)('%p retires the row on DELETE /:id through softRemove, never the hard delete', async (controller) => {
			const service = {
				delete: jest.fn().mockResolvedValue({ affected: 1 }),
				softRemove: jest.fn().mockResolvedValue({ id: ID, deletedAt: new Date() }),
				reveal: jest.fn()
			};
			const instance = new (controller as any)(service, service, service, service);

			await instance.delete(ID);
			await instance.softRemove(ID);

			expect(service.softRemove).toHaveBeenCalledTimes(2);
			expect(service.delete).not.toHaveBeenCalled();
		});

		it('no source file of the plugin calls a hard delete (05 §1.7: only a retention job deletes these rows)', () => {
			const offenders: string[] = [];
			const walk = (directory: string) => {
				for (const entry of readdirSync(directory, { withFileTypes: true })) {
					const path = join(directory, entry.name);
					if (entry.isDirectory()) {
						if (entry.name !== 'migrations') walk(path);
						continue;
					}
					if (!entry.name.endsWith('.ts') || entry.name.includes('.spec.')) continue;
					readFileSync(path, 'utf8')
						.split(/\r?\n/)
						.forEach((line, index) => {
							if (/\.(delete|remove|nativeDelete|hardDelete)\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
								offenders.push(`${path}:${index + 1}: ${line.trim()}`);
							}
						});
				}
			};

			walk(join(__dirname, '..'));

			expect(offenders).toEqual([]);
		});
	});
});
