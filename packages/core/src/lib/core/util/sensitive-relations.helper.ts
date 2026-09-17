import { ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { SensitiveRelationConfig } from '../decorators/sensitive-relations.decorator';
import { RequestContext } from '../context';
import { normalizeRelationsToPaths } from '../utils';
import { ORGANIZATION_SENSITIVE_RELATIONS } from './organization-sensitive-relations.config';

/**
 * Key a {@link SensitiveRelationConfig} node uses to declare the permission required to load the
 * relation the node itself describes (as opposed to the relations nested under it).
 */
export const SENSITIVE_RELATION_SELF_KEY = '_self';

/**
 * Name of the entity the {@link ORGANIZATION_SENSITIVE_RELATIONS} table is written against.
 */
const ORGANIZATION_ENTITY_NAME = 'Organization';

/**
 * Property name under which {@link ORGANIZATION_SENSITIVE_RELATIONS} nests the organization sub-tree,
 * and the relation name every `TenantOrganizationBaseEntity` uses to reach its organization.
 */
const ORGANIZATION_RELATION_PROPERTY = 'organization';

/**
 * The sub-tree of {@link ORGANIZATION_SENSITIVE_RELATIONS} that describes the relations reachable
 * FROM an `Organization` row (`payments`, `invoices`, `employees`, `contact`, …).
 *
 * The table declares those relations twice — once at the top level, for a controller whose own
 * entity IS the organization, and once under `organization`, for a controller that reaches the
 * organization through a relation. Both declarations describe the same rows, so both are merged
 * here: the sink-level check keys off the ENTITY it is standing on rather than off the shape of the
 * requested path, and must not depend on which half of the table an entry was added to.
 */
const {
	// An organization has no `organization` relation of its own; dropping the key keeps the pre-filter
	// below tight, since almost every request names `organization` at some point.
	[ORGANIZATION_RELATION_PROPERTY]: organizationSubTree,
	...topLevelOrganizationRelations
} = ORGANIZATION_SENSITIVE_RELATIONS;

const ORGANIZATION_RELATION_PERMISSIONS = {
	...topLevelOrganizationRelations,
	...((organizationSubTree ?? {}) as SensitiveRelationConfig)
} as SensitiveRelationConfig;

/**
 * Relation names the organization table declares. Used only as a cheap pre-filter so an ordinary
 * request (`relations[0]=user&relations[1]=organization`) never pays for an entity-metadata walk.
 */
const SENSITIVE_ORGANIZATION_RELATION_NAMES: ReadonlySet<string> = new Set(
	Object.keys(ORGANIZATION_RELATION_PERMISSIONS).filter((key: string) => key !== SENSITIVE_RELATION_SELF_KEY)
);

/**
 * Type guard for a config value that names a permission.
 *
 * @param value - The config value to test.
 * @returns Whether the value is a known {@link PermissionsEnum} member.
 */
export function isValidPermission(value: any): value is PermissionsEnum {
	return typeof value === 'string' && Object.values(PermissionsEnum).includes(value as PermissionsEnum);
}

/**
 * Returns the required permission for a given relation path by traversing the config tree.
 * Supports nested relations (e.g. 'organization.employees.user').
 *
 * A node that declares both its own permission (`_self`) and nested rules
 * (`employees: { _self: ORG_EMPLOYEES_VIEW, user: ORG_USERS_VIEW }`) does NOT end the walk: the path
 * keeps descending, so `organization.employees.user` resolves to the deeper `ORG_USERS_VIEW` instead of
 * stopping at `ORG_EMPLOYEES_VIEW`. Returning the first `_self` met would let a caller holding only the
 * parent permission load the nested relation too. The nearest `_self` above the last resolvable segment
 * is the answer only when nothing deeper is declared — the relation it guards is loaded all the same.
 *
 * Callers are expected to check every prefix of a path as well (see `normalizeRelationsToPaths`), so
 * the permission guarding `organization.employees` is enforced on its own row.
 *
 * @param config - The sensitive relations config object (nested structure)
 * @param relationPath - The relation path requested (dot notation)
 * @returns The required permission as a PermissionsEnum, or null if none is required
 */
export function getRequiredPermissionForRelation(
	config: SensitiveRelationConfig,
	relationPath: string
): PermissionsEnum | null {
	const pathParts = relationPath.split('.');
	let current: SensitiveRelationConfig | undefined = config;
	// The `_self` permission of the deepest node traversed so far; it still applies to everything below.
	let inherited: PermissionsEnum | null = null;

	for (const part of pathParts) {
		if (!current) {
			return inherited;
		}
		const value = current[part];

		if (typeof value === 'object' && value !== null) {
			const self = (value as SensitiveRelationConfig)[SENSITIVE_RELATION_SELF_KEY];
			if (isValidPermission(self)) {
				inherited = self;
			}
			current = value as SensitiveRelationConfig;
		} else if (isValidPermission(value)) {
			return value;
		} else {
			// Nothing declared for this hop: whatever guards the relation above it still applies.
			return inherited;
		}
	}
	return inherited;
}

/**
 * Resolves what one path segment costs against a config node.
 *
 * @param config - The config node the walk currently stands on.
 * @param segment - The relation property being traversed.
 * @returns The permission this hop requires (if any) and the config node that governs deeper hops.
 */
function resolveSegmentRule(
	config: SensitiveRelationConfig,
	segment: string
): { permission: PermissionsEnum | null; next: SensitiveRelationConfig | undefined } {
	const rule = config[segment];

	if (rule && typeof rule === 'object') {
		const self = (rule as SensitiveRelationConfig)[SENSITIVE_RELATION_SELF_KEY];
		return {
			permission: isValidPermission(self) ? self : null,
			// Nested declarations (`employees: { _self: …, user: … }`) keep governing the hops below.
			next: rule as SensitiveRelationConfig
		};
	}

	return { permission: isValidPermission(rule) ? rule : null, next: undefined };
}

/**
 * Whether the given entity metadata describes the `Organization` entity.
 *
 * @param metadata - The entity metadata to test.
 * @returns True when the metadata belongs to `Organization`.
 */
function isOrganizationEntity(metadata: EntityMetadata | undefined): boolean {
	return !!metadata && (metadata.name === ORGANIZATION_ENTITY_NAME || metadata.tableName === 'organization');
}

/**
 * Enforces {@link ORGANIZATION_SENSITIVE_RELATIONS} at the data-access boundary, for EVERY entity.
 *
 * `SensitiveRelationsInterceptor` is the declarative, per-controller layer of this protection, but it
 * is mounted on 5 of the ~83 controllers that accept a client-supplied `relations` option — while
 * every entity extending `TenantOrganizationBaseEntity` exposes an `organization` relation. A single
 * unguarded controller is therefore enough to reach the very rows the table protects
 * (`GET /api/equipment/pagination?relations[0]=organization.payments` — no `@Permissions`, no
 * interceptor, plain array form, no bypass trick at all). This function closes that at the sink so it
 * cannot recur as controllers are added.
 *
 * NOTE the boundary: `CrudService` calls this on its read methods. A service that builds its own
 * `createQueryBuilder(...).setFindOptions({ relations })` (`TagService.findTags` behind `GET /api/tags`,
 * `TaskService`, `EmployeeService.pagination`, the time-tracking report services and others) never
 * reaches those methods, so each such method must call `CrudService.assertRelationsPermitted` — or
 * this function, with the metadata of the repository it actually queries — before applying a
 * client-supplied `relations`. Relation lists the server builds itself need no check.
 *
 * The walk advances over the entity graph rather than over the shape of the requested string, so a
 * relation is gated by WHICH entity it is loaded from: `Organization.payments` needs
 * `ORG_PAYMENT_VIEW`, while the unrelated `Invoice.payments` — which the invoices UI loads with
 * `INVOICES_VIEW` — is untouched. The path is checked hop by hop, and a hop that cannot be resolved
 * in the entity metadata simply ends the walk: TypeORM rejects such a path itself, and the prefixes
 * already traversed have been checked.
 *
 * Only client-driven reads are gated. With no request context there is no caller whose permissions
 * could be consulted and no client-supplied `relations` either — seeding, migrations and background
 * jobs build their own options in code — so the check is skipped rather than failing those closed.
 *
 * @param metadata - Entity metadata of the repository the read is issued against.
 * @param relations - The requested `relations` option, in ANY representation.
 * @throws ForbiddenException when a requested relation requires a permission the caller lacks.
 */
export function assertSensitiveRelationsAllowed(metadata: EntityMetadata | undefined, relations: unknown): void {
	// No metadata means we cannot tell which entity a relation is loaded from; there is nothing to
	// walk and the legacy behaviour (no sink-level check at all) applies.
	if (!metadata || relations === null || relations === undefined) {
		return;
	}

	// Server-side callers (seeders, migrations, schedulers) are not a trust boundary — see above.
	if (!RequestContext.currentRequestContext()) {
		return;
	}

	const paths = normalizeRelationsToPaths(relations);
	if (paths.length === 0) {
		return;
	}

	// Cheap pre-filter: unless a requested segment is a name the table declares, no walk is needed.
	const touchesSensitiveName = paths.some((path: string) =>
		path.split('.').some((segment: string) => SENSITIVE_ORGANIZATION_RELATION_NAMES.has(segment))
	);
	if (!touchesSensitiveName) {
		return;
	}

	// `RequestContext.hasPermission` verifies the JWT on every call; memoize per assertion.
	const verdicts = new Map<PermissionsEnum, boolean>();
	const hasPermission = (permission: PermissionsEnum): boolean => {
		const cached = verdicts.get(permission);
		if (cached !== undefined) {
			return cached;
		}
		const verdict = RequestContext.hasPermission(permission);
		verdicts.set(permission, verdict);
		return verdict;
	};

	for (const path of paths) {
		let entityMetadata: EntityMetadata | undefined = metadata;
		let config: SensitiveRelationConfig | undefined = isOrganizationEntity(entityMetadata)
			? ORGANIZATION_RELATION_PERMISSIONS
			: undefined;

		for (const segment of path.split('.')) {
			if (config) {
				const { permission, next } = resolveSegmentRule(config, segment);
				if (permission && !hasPermission(permission)) {
					throw new ForbiddenException(
						`Access to the sensitive relation '${path}' is forbidden. Required permission: '${permission}'.`
					);
				}
				config = next;
			}

			if (!entityMetadata) {
				break;
			}

			// Advance one hop over the entity graph.
			const relation = entityMetadata.findRelationWithPropertyPath(segment);
			entityMetadata = relation ? relation.inverseEntityMetadata : undefined;

			// Landing on an organization (re)arms the organization table for the hops below, so
			// `employee.organization.payments` is gated exactly like `organization.payments`.
			if (isOrganizationEntity(entityMetadata)) {
				config = ORGANIZATION_RELATION_PERMISSIONS;
			}
		}
	}
}
