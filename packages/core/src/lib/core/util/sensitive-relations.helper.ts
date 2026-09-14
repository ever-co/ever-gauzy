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
 * @param config - The sensitive relations config object (nested structure)
 * @param relationPath - The relation path requested (dot notation)
 * @returns The required permission as a PermissionsEnum, or null if none is required
 */
export function getRequiredPermissionForRelation(
	config: SensitiveRelationConfig,
	relationPath: string
): PermissionsEnum | null {
	const pathParts = relationPath.split('.');
	let current: SensitiveRelationConfig | PermissionsEnum | null = config;

	for (const part of pathParts) {
		if (!current || typeof current !== 'object') return null;
		const value = current[part];

		if (typeof value === 'object' && value !== null) {
			if (SENSITIVE_RELATION_SELF_KEY in value && value[SENSITIVE_RELATION_SELF_KEY]) {
				return value[SENSITIVE_RELATION_SELF_KEY] as PermissionsEnum;
			}
			current = value as SensitiveRelationConfig;
		} else if (isValidPermission(value)) {
			return value as PermissionsEnum;
		} else {
			return null;
		}
	}
	return null;
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
 * NOTE the boundary: this covers the reads that go through `CrudService`. A service that builds its
 * own `createQueryBuilder(...).setFindOptions({ relations })` — `TagService.findTags` (behind
 * `GET /api/tags`), `CandidateService.pagination`, `OrganizationTeamService.findAll` and a handful of
 * others — never reaches this function, and is protected only if its controller mounts the
 * interceptor. Those call sites still need auditing; see GHSA-c3cj-m3xm-7j5h follow-ups.
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
