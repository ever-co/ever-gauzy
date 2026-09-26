// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import type { FindManyOptions } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalService } from './request-approval.service';

/**
 * The statement the register's list sends on MikroORM, on the two dialects the real-store suite
 * (`request-approval.orm-parity.spec.ts`, better-sqlite3) cannot reach.
 *
 * The list is a hand-written knex statement rather than a MikroORM query, so nothing but the statement itself
 * says it is right: it used to name an alias knex has no argument for and could not be compiled on any
 * dialect (`The operator "approval_policy.id" is not permitted`), and its polymorphic join was written in
 * double quotes, which MySQL reads as two string literals. Each case compiles the statement with MikroORM's
 * own knex for the dialect and pins it.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

/** The route's own default for an unstated envelope, as the resolver passes it. */
const NO_RELATIONS = { relations: [] } as unknown as FindManyOptions<RequestApproval>;

const TENANT = 'tenant-a';
const ORG = 'org-a';

/** MikroORM's knex for the dialect, answering every statement with no rows and keeping what it was sent. */
function capturingKnex(client: 'pg' | 'mysql2') {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const knex = require('@mikro-orm/knex').knex({ client });
	const statements: { sql: string; bindings: readonly unknown[] }[] = [];

	knex.client.runner = (builder: { toSQL(): { sql: string; bindings: readonly unknown[] } }) => ({
		run: async () => {
			const { sql, bindings } = builder.toSQL();
			statements.push({ sql, bindings });
			return [];
		}
	});

	return { knex, statements };
}

function createService(knex: unknown) {
	const repository = { getKnex: () => knex, findAndCount: jest.fn(async () => [[], 0]) };

	return new RequestApprovalService({} as any, repository as any, {} as any, {} as any, {} as any, {} as any);
}

describe('RequestApprovalService.findAllRequestApprovals on MikroORM, per dialect', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	it('joins the policy by its key, and the requested row by its id as text, on Postgres', async () => {
		(isPostgres as jest.Mock).mockReturnValue(true);
		const { knex, statements } = capturingKnex('pg');

		await expect(createService(knex).findAllRequestApprovals(NO_RELATIONS, {})).resolves.toEqual({
			items: [],
			total: 0
		});

		expect(statements).toEqual([
			{
				sql:
					'select "request_approval"."id" from "request_approval"' +
					' left join "approval_policy" on "approval_policy"."id" = "request_approval"."approvalPolicyId" and "approval_policy"."deletedAt" is null' +
					' left join "time_off_request" on "time_off_request"."id"::text = "request_approval"."requestId" and "time_off_request"."deletedAt" is null' +
					' left join "equipment_sharing" on "equipment_sharing"."id"::text = "request_approval"."requestId" and "equipment_sharing"."deletedAt" is null' +
					' where (("approval_policy"."organizationId" = ? and "approval_policy"."tenantId" = ?)' +
					' or ("time_off_request"."organizationId" = ? and "time_off_request"."tenantId" = ?)' +
					' or ("equipment_sharing"."organizationId" = ? and "equipment_sharing"."tenantId" = ?)' +
					' or ("request_approval"."organizationId" = ? and "request_approval"."tenantId" = ?))' +
					' and "request_approval"."deletedAt" is null',
				bindings: [ORG, TENANT, ORG, TENANT, ORG, TENANT, ORG, TENANT]
			}
		]);
	});

	it('quotes the polymorphic join as identifiers, not as string literals, on MySQL', async () => {
		(isMySQL as jest.Mock).mockReturnValue(true);
		const { knex, statements } = capturingKnex('mysql2');

		await createService(knex).findAllRequestApprovals(NO_RELATIONS, {});

		expect(statements).toHaveLength(1);
		expect(statements[0].sql).toContain(
			'left join `time_off_request` on CAST(`time_off_request`.`id` AS CHAR) COLLATE utf8mb4_unicode_ci = `request_approval`.`requestId` COLLATE utf8mb4_unicode_ci and `time_off_request`.`deletedAt` is null'
		);
		expect(statements[0].sql).toContain(
			'left join `equipment_sharing` on CAST(`equipment_sharing`.`id` AS CHAR) COLLATE utf8mb4_unicode_ci = `request_approval`.`requestId` COLLATE utf8mb4_unicode_ci and `equipment_sharing`.`deletedAt` is null'
		);
		expect(statements[0].sql).not.toContain('"');
	});

	it('compares a scope the caller does not have as `= NULL`, which matches nothing, rather than `IS NULL`', async () => {
		(isPostgres as jest.Mock).mockReturnValue(true);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(undefined);
		const { knex, statements } = capturingKnex('pg');

		await createService(knex).findAllRequestApprovals(NO_RELATIONS, {});

		expect(statements[0].sql).not.toContain('"organizationId" is null');
		expect(statements[0].bindings).toEqual([null, TENANT, null, TENANT, null, TENANT, null, TENANT]);
	});
});
