import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { IShareRule } from '@gauzy/contracts';
import {
	assertShareRulesAreSafe,
	buildSharedEntitySelect,
	filterSharedEntity,
	SHARED_ENTITY_MAX_RELATION_DEPTH
} from './shared-entity.helper';

/**
 * Regression suite for the SharedEntity cross-tenant pivot (GHSA-cx2q-xmh2-pc38 / GHSA-gpg5-qwjc-8hqh
 * residuals).
 *
 * The token route is `@Public()`: there is no request-context tenant, so every isolation decision is
 * made from the SHARE's own stored scope. Three ways the first round of fixes still leaked:
 *
 * - a `null` sub-rule (`{ relations: { employees: null } }`) was treated as a harmless leaf, and
 *   `buildSharedEntityRelations` turns it into `relation: true` — the whole related row, its eager
 *   relations included, with no field allow-list and no further validation of what that hop reaches;
 * - an unresolved relation left `tenantId` out of the nested select, and the scope filter only
 *   compared when `row.tenantId` was truthy — so an unjudgeable row was KEPT (fail open);
 * - and the depth bound has to hold for the nested rules too, not just the root.
 */

/** Minimal EntityMetadata stand-in: only the two lookups the helper actually uses. */
interface IFakeEntity {
	name: string;
	columns: string[];
	relations?: Record<string, string>;
}

function metadataFor(name: string, graph: Record<string, IFakeEntity>): EntityMetadata {
	const entity = graph[name];
	return {
		name: entity.name,
		findColumnWithPropertyPath: (path: string) => (entity.columns.includes(path) ? ({ propertyPath: path } as any) : undefined),
		findRelationWithPropertyPath: (path: string) => {
			const target = entity.relations?.[path];
			if (!target) return undefined;
			return { propertyPath: path, inverseEntityMetadata: metadataFor(target, graph) } as any;
		}
	} as unknown as EntityMetadata;
}

const GRAPH: Record<string, IFakeEntity> = {
	Organization: {
		name: 'Organization',
		columns: ['id', 'name', 'tenantId', 'organizationId'],
		relations: { employees: 'Employee', featureOrganizations: 'FeatureOrganization' }
	},
	Employee: { name: 'Employee', columns: ['id', 'billRateValue', 'tenantId', 'organizationId'] },
	// A GLOBAL (tenant-less) entity — the pivot point of the original advisory.
	FeatureOrganization: { name: 'FeatureOrganization', columns: ['id', 'featureId'] }
};

const ORGANIZATION = () => metadataFor('Organization', GRAPH);

describe('assertShareRulesAreSafe', () => {
	it('accepts a plain, tenant-scoped share', () => {
		const rules: IShareRule = { fields: ['name'], relations: { employees: { fields: ['billRateValue'] } } };
		expect(() => assertShareRulesAreSafe(ORGANIZATION(), rules)).not.toThrow();
	});

	it('accepts rules with no relations at all', () => {
		expect(() => assertShareRulesAreSafe(ORGANIZATION(), { fields: ['name'] } as IShareRule)).not.toThrow();
		expect(() => assertShareRulesAreSafe(ORGANIZATION(), { fields: [], relations: {} } as IShareRule)).not.toThrow();
	});

	it('refuses a hop into a tenant-less entity (the original pivot)', () => {
		const rules = { fields: ['name'], relations: { featureOrganizations: { fields: ['featureId'] } } } as IShareRule;
		expect(() => assertShareRulesAreSafe(ORGANIZATION(), rules)).toThrow(ForbiddenException);
	});

	it('refuses an unknown relation', () => {
		const rules = { fields: [], relations: { nope: { fields: [] } } } as unknown as IShareRule;
		expect(() => assertShareRulesAreSafe(ORGANIZATION(), rules)).toThrow(BadRequestException);
	});

	it.each([[null], [undefined], ['employees'], [[]]])(
		'refuses a %p sub-rule instead of treating it as a leaf',
		(subRules) => {
			const rules = { fields: [], relations: { employees: subRules } } as unknown as IShareRule;
			expect(() => assertShareRulesAreSafe(ORGANIZATION(), rules)).toThrow(BadRequestException);
		}
	);

	it(`bounds the nesting at ${SHARED_ENTITY_MAX_RELATION_DEPTH} hops`, () => {
		// Organization -> employees -> (would need a 3rd hop)
		const deep = {
			fields: [],
			relations: { employees: { fields: [], relations: { anything: { fields: [] } } } }
		} as unknown as IShareRule;
		expect(() => assertShareRulesAreSafe(ORGANIZATION(), deep)).toThrow(BadRequestException);
	});

	it('refuses a non-object / array relations map', () => {
		expect(() =>
			assertShareRulesAreSafe(ORGANIZATION(), { fields: [], relations: 'employees' } as unknown as IShareRule)
		).toThrow(BadRequestException);
		expect(() =>
			assertShareRulesAreSafe(ORGANIZATION(), { fields: [], relations: ['employees'] } as unknown as IShareRule)
		).toThrow(BadRequestException);
	});
});

describe('buildSharedEntitySelect', () => {
	it('always selects the scope columns so joined rows can be judged afterwards', () => {
		const select = buildSharedEntitySelect({ fields: ['name'] } as IShareRule, ORGANIZATION());
		expect(select).toMatchObject({ id: true, name: true, tenantId: true, organizationId: true });
	});

	it('never selects a forbidden column even when the rules name it', () => {
		const select = buildSharedEntitySelect({ fields: ['name', 'hash', 'refreshToken'] } as IShareRule, ORGANIZATION());
		expect(select).not.toHaveProperty('hash');
		expect(select).not.toHaveProperty('refreshToken');
	});

	it('fails CLOSED when a relation cannot be resolved against the metadata', () => {
		// An unresolved hop means no `tenantId` in the nested select — and a row without `tenantId`
		// cannot be scope-checked. Building the query at all would return unjudgeable rows.
		const rules = { fields: [], relations: { ghost: { fields: [] } } } as unknown as IShareRule;
		expect(() => buildSharedEntitySelect(rules, ORGANIZATION())).toThrow(BadRequestException);
	});
});

describe('filterSharedEntity', () => {
	const SCOPE = { tenantId: 'tenant-A', organizationId: 'org-1' };
	const RULES = { fields: ['name'], relations: { employees: { fields: ['billRateValue'] } } } as IShareRule;

	const entity = () => ({
		id: 'org-1',
		name: 'Acme',
		tenantId: 'tenant-A',
		employees: [
			{ id: 'e1', billRateValue: 10, tenantId: 'tenant-A', organizationId: 'org-1' },
			{ id: 'e2', billRateValue: 20, tenantId: 'tenant-B', organizationId: 'org-9' }, // another tenant
			{ id: 'e3', billRateValue: 30 } // scope columns MISSING — unjudgeable
		]
	});

	it('drops joined rows belonging to another tenant', () => {
		const result = filterSharedEntity(entity(), RULES, SCOPE, ORGANIZATION());
		expect(result.employees).toEqual([{ billRateValue: 10 }]);
	});

	it('drops a joined row whose tenantId was never selected — fail closed', () => {
		const result = filterSharedEntity(entity(), RULES, SCOPE, ORGANIZATION());
		expect(result.employees).toHaveLength(1);
		expect(result.employees).not.toContainEqual({ billRateValue: 30 });
	});

	it('CONTROL: without the metadata the unjudgeable row is kept — the pre-fix fail-open', () => {
		// Same data, same scope, no metadata: `'tenantId' in row` is false for e3, so it survives.
		const result = filterSharedEntity(entity(), RULES, SCOPE);
		expect(result.employees).toEqual([{ billRateValue: 10 }, { billRateValue: 30 }]);
	});

	it('never emits a forbidden field even if the stored rules name it', () => {
		const rules = { fields: ['name', 'hash'] } as IShareRule;
		const result = filterSharedEntity({ name: 'Acme', hash: 'secret' }, rules, SCOPE, ORGANIZATION());
		expect(result).toEqual({ name: 'Acme' });
		expect(result).not.toHaveProperty('hash');
	});
});
