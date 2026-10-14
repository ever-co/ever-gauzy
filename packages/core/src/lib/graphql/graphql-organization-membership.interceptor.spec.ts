/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `role-entity.resolver.spec.ts`.
 */
import '../core/entities/internal';

import * as fs from 'fs';
import * as path from 'path';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { buildSchema, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { lastValueFrom, of } from 'rxjs';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { RequestContext } from '../core/context';
import { GraphqlOrganizationMembershipInterceptor, statedOrganizations } from './graphql-organization-membership.interceptor';

/**
 * R7-03 (P0, security review of #10254): GraphQL ran no class-validator, so `@IsOrganizationBelongsToUser()` — the
 * REST rule that closed GHSA-44pv-34gx-q9p4 — was absent from every GraphQL field that takes an `organizationId`, and
 * a member of organization A could read organization B's payroll with `{ payrollItems(organizationId:"<B>") … }`
 * (REST `GET /api/payroll-run?organizationId=B` answers 400) or file a cost into it with `createExpense`.
 *
 * The rule is now one global interceptor making the REST validator's own lookup. These cases run it against the
 * REAL argument definitions of the committed composed schema, for core fields and for two commerce plugins.
 */
const SCHEMA: GraphQLSchema = buildSchema(
	fs.readFileSync(path.join(__dirname, 'schema', 'schema.graphql'), 'utf8'),
	{ assumeValidSDL: true }
);

const MINE = 'organization-mine';
const THEIRS = 'organization-theirs';

/** The REST validator's lookup, scripted: the caller belongs to MINE only. */
const membership = { checkOrganizationExistence: jest.fn(async (id: string) => id === MINE) };

function interceptor(): GraphqlOrganizationMembershipInterceptor {
	return new GraphqlOrganizationMembershipInterceptor(new Reflector(), membership as never);
}

/** A GraphQL execution context for one root field of the schema, with the arguments a client sent. */
function graphqlCall(operation: 'Query' | 'Mutation' | 'Subscription', field: string, args: Record<string, unknown>, isPublic = false) {
	const parentType = SCHEMA.getType(operation) as GraphQLObjectType;
	expect(parentType.getFields()[field]).toBeDefined();
	class Resolver {}
	const handler = function resolve() {};
	if (isPublic) Reflect.defineMetadata(PUBLIC_METHOD_METADATA, true, handler);
	const host = new ExecutionContextHost([{}, args, { req: {} }, { parentType, fieldName: field }], Resolver as never, handler as never);
	host.setType('graphql');
	return host;
}

async function run(context: ExecutionContextHost): Promise<unknown> {
	const next = { handle: jest.fn(() => of('resolved')) };
	const result = await interceptor().intercept(context, next);
	return { value: await lastValueFrom(result), called: next.handle.mock.calls.length };
}

describe('GraphQL organization membership (R7-03) — the REST validator’s rule on every GraphQL field', () => {
	beforeEach(() => {
		membership.checkOrganizationExistence.mockClear();
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});
	afterEach(() => jest.restoreAllMocks());

	describe('R7’s exact reads and writes are refused for a foreign organization, and served for the caller’s own', () => {
		it.each([
			['core — payroll, the review’s query', 'Query', 'payrollItems', (org: string) => ({ organizationId: org })],
			['core — payroll statistics', 'Query', 'payrollRunStatistics', (org: string) => ({ organizationId: org })],
			['core — filing a cost', 'Mutation', 'createExpense', (org: string) => ({ input: { organizationId: org, amount: '10' } })],
			['core — a list filtered to an organization', 'Query', 'warehouses', (org: string) => ({ filter: { organizationId: { eq: org } } })],
			['plugin search', 'Query', 'search', (org: string) => ({ input: { q: 'salary', organizationId: org } })],
			['plugin pricing', 'Mutation', 'createPriceList', (org: string) => ({ input: { name: 'x', organizationId: org } })],
			['plugin tax', 'Mutation', 'createTaxCategory', (org: string) => ({ input: { name: 'x', organizationId: org } })]
		] as const)('%s (%s.%s)', async (_label, operation, field, args) => {
			await expect(run(graphqlCall(operation, field, args(THEIRS)))).rejects.toBeInstanceOf(ApiException);
			expect(membership.checkOrganizationExistence).toHaveBeenCalledWith(THEIRS);

			await expect(run(graphqlCall(operation, field, args(MINE)))).resolves.toEqual({ value: 'resolved', called: 1 });
		});
	});

	it('answers the refusal REST answers: a 400 validation failure naming the field', async () => {
		const error = (await run(graphqlCall('Query', 'payrollItems', { organizationId: THEIRS })).catch((thrown) => thrown)) as ApiException;

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(400);
		expect(error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect(error.details).toEqual({ field: 'organizationId' });
		expect(error.message).toContain('is not associated with the specified organization');
	});

	it('lets an operation that names no organization through without a lookup, as REST’s empty value passes', async () => {
		await expect(run(graphqlCall('Query', 'payrollItems', {}))).resolves.toEqual({ value: 'resolved', called: 1 });
		await expect(run(graphqlCall('Mutation', 'createExpense', { input: { amount: '10', organizationId: null } }))).resolves.toBeDefined();
		expect(membership.checkOrganizationExistence).not.toHaveBeenCalled();
	});

	it('does not check a public field — its REST twin never runs the validator, which fails closed without a user', async () => {
		await expect(run(graphqlCall('Query', 'payrollItems', { organizationId: THEIRS }, true))).resolves.toBeDefined();
		expect(membership.checkOrganizationExistence).not.toHaveBeenCalled();
	});

	it('leaves REST and every non-GraphQL context alone', async () => {
		const http = new ExecutionContextHost([{ query: { organizationId: THEIRS } }]);
		http.setType('http');
		const next = { handle: jest.fn(() => of('served')) };

		await expect(lastValueFrom(await interceptor().intercept(http, next))).resolves.toBe('served');
		expect(membership.checkOrganizationExistence).not.toHaveBeenCalled();
	});

	describe('statedOrganizations — what the walk reads, through the declared argument types', () => {
		const args = (operation: 'Query' | 'Mutation', field: string) =>
			(SCHEMA.getType(operation) as GraphQLObjectType).getFields()[field].args;

		it('reads a top-level argument, an input member and an IDFilter’s eq / in, and ignores ne', () => {
			expect([...statedOrganizations({ organizationId: 'a' }, args('Query', 'payrollItems')).ids]).toEqual(['a']);
			expect([...statedOrganizations({ input: { organizationId: 'b' } }, args('Mutation', 'createExpense')).ids]).toEqual(['b']);
			expect(
				[...statedOrganizations({ filter: { organizationId: { in: ['c', 'd'], ne: 'e' } } }, args('Query', 'warehouses')).ids].sort()
			).toEqual(['c', 'd']);
		});

		it('flags what REST refuses without a lookup: a non-string id', () => {
			expect(statedOrganizations({ organizationId: 42 }, args('Query', 'payrollItems')).malformed).toBe(true);
			expect(statedOrganizations({ filter: { organizationId: { eq: 7 } } }, args('Query', 'warehouses')).malformed).toBe(true);
		});

		it('never reaches inside a JSON argument, which no DTO validator reached inside either', () => {
			const preview = (SCHEMA.getType('Query') as GraphQLObjectType).getFields()['accountingTemplatePreview'];
			expect(preview).toBeDefined();
			const found = statedOrganizations({ organization: { organizationId: THEIRS }, data: { organizationId: THEIRS } }, preview.args);
			expect(found.ids.size).toBe(0);
			expect(found.malformed).toBe(false);
		});
	});

	it('is registered globally, before the idempotency interceptor', () => {
		const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.module.ts'), 'utf8');
		const membershipAt = source.indexOf('useClass: GraphqlOrganizationMembershipInterceptor');
		const idempotencyAt = source.indexOf('useClass: IdempotencyInterceptor');

		expect(membershipAt).toBeGreaterThan(-1);
		expect(source.slice(source.lastIndexOf('provide:', membershipAt), membershipAt)).toContain('APP_INTERCEPTOR');
		expect(membershipAt).toBeLessThan(idempotencyAt);
	});
});
