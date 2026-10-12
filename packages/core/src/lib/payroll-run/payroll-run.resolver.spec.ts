// cspell:ignore payrollrun
/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import {
	PayrollFrequencyEnum,
	PayrollItemCategoryEnum,
	PayrollItemTypeEnum,
	PayrollRunStatusEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { PayrollRunController } from './payroll-run.controller';
import { PayrollRunResolver } from './payroll-run.resolver';
import { PayrollRunService } from './payroll-run.service';

/**
 * The payroll runs over GraphQL.
 *
 * The delivered REST routes list an organization's runs, read one, aggregate the paid ones, break one
 * down per employee, open a run, edit it, move it through four workflow states, and add and remove its
 * lines. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - every field reaches the same `PayrollRunService` method the REST route reaches, so a client does not
 *   choose a better surface by choosing a protocol;
 * - **the three permissions are the three the controller's routes state**: the reads carry the view
 *   grant, the two operations that move money carry the approve grant, and everything else carries the
 *   class-level edit grant;
 * - money is `Decimal` and never `Float`, and the service's own working values — the integer cents and
 *   the counted set of employees — are not members;
 * - a run that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const JANUARY = '00000000-0000-4000-8000-000000000010';
const FEBRUARY = '00000000-0000-4000-8000-000000000011';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const ITEM = '00000000-0000-4000-8000-000000000030';

/** The runs a scripted service answers with, in the order the delivered list read returns them. */
const RUNS = [
	{
		id: FEBRUARY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		periodStart: new Date('2026-02-01T00:00:00.000Z'),
		periodEnd: new Date('2026-02-28T00:00:00.000Z'),
		payDate: new Date('2026-03-01T00:00:00.000Z'),
		frequency: PayrollFrequencyEnum.MONTHLY,
		status: PayrollRunStatusEnum.DRAFT,
		currency: 'USD',
		totalGross: 5000,
		totalDeductions: 1000,
		totalNet: 4000,
		notes: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: JANUARY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		periodStart: new Date('2026-01-01T00:00:00.000Z'),
		periodEnd: new Date('2026-01-31T00:00:00.000Z'),
		payDate: new Date('2026-02-01T00:00:00.000Z'),
		frequency: PayrollFrequencyEnum.MONTHLY,
		status: PayrollRunStatusEnum.PAID,
		currency: 'EUR',
		totalGross: 3000,
		totalDeductions: 500,
		totalNet: 2500,
		notes: 'January payroll',
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-31T10:00:00.000Z')
	}
];

/** One line, as the route that adds it answers it. */
const ITEM_ROW = {
	id: ITEM,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	payrollRunId: FEBRUARY,
	employeeId: EMPLOYEE,
	type: PayrollItemTypeEnum.BASIC_SALARY,
	category: PayrollItemCategoryEnum.EARNING,
	description: 'February salary',
	amount: 5000,
	quantity: 1,
	unitPrice: 5000,
	taxable: true
};

/** The resolver, over a scripted service. */
function surfaces() {
	const payrollRunService = {
		findAllRuns: jest.fn().mockResolvedValue({ items: RUNS, total: RUNS.length }),
		findOneRun: jest.fn().mockResolvedValue(RUNS[0]),
		getStatistics: jest.fn().mockResolvedValue([
			{
				totalRuns: 1,
				totalEmployeesPaid: 1,
				totalGrossPaid: 3000,
				totalDeductions: 500,
				totalNetPaid: 2500,
				currency: 'EUR'
			}
		]),
		getSummaryByRun: jest.fn().mockResolvedValue([
			{
				employeeId: EMPLOYEE,
				periodStart: RUNS[0].periodStart,
				periodEnd: RUNS[0].periodEnd,
				grossPay: 5000,
				totalDeductions: 1000,
				netPay: 4000,
				currency: 'USD'
			}
		]),
		findItems: jest.fn().mockResolvedValue({ items: [ITEM_ROW], total: 1 }),
		updateItem: jest.fn().mockResolvedValue({ ...ITEM_ROW, amount: 5100 }),
		createRun: jest.fn().mockResolvedValue(RUNS[0]),
		updateRun: jest.fn().mockResolvedValue(RUNS[0]),
		submitForApproval: jest.fn().mockResolvedValue(RUNS[0]),
		approve: jest.fn().mockResolvedValue(RUNS[0]),
		process: jest.fn().mockResolvedValue(RUNS[1]),
		cancel: jest.fn().mockResolvedValue(RUNS[0]),
		addItem: jest.fn().mockResolvedValue(ITEM_ROW),
		removeItem: jest.fn().mockResolvedValue({ affected: 1 })
	};

	return { payrollRunService, resolver: new PayrollRunResolver(payrollRunService as never) };
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
		.filter((field) => field.toLowerCase().includes('payrollrun'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input object, so a member no write accepts can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof PayrollRunController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof PayrollRunController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof PayrollRunController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = PayrollRunResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('PayrollRunResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the node and the two computed reads', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'payrollRuns',
				'payrollRun',
				'payrollRunStatistics',
				'payrollRunSummary'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createPayrollRun',
				'updatePayrollRun',
				'submitPayrollRun',
				'approvePayrollRun',
				'processPayrollRun',
				'cancelPayrollRun',
				'addPayrollRunItem',
				'removePayrollRunItem'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'payrollRun',
			'payrollRunStatistics',
			'payrollRunSummary',
			'payrollRuns'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'addPayrollRunItem',
			'approvePayrollRun',
			'cancelPayrollRun',
			'createPayrollRun',
			'processPayrollRun',
			'removePayrollRunItem',
			'submitPayrollRun',
			'updatePayrollRun'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type PayrollRunConnection \{\s*nodes: \[PayrollRun!\]!\s*edges: \[PayrollRunEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type PayrollRunEdge \{\s*node: PayrollRun!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input PayrollRunFilter \{/);
		expect(printed).toMatch(/input PayrollRunSort \{/);
		expect(printed).toMatch(
			/enum PayrollRunSortField \{\s*periodStart\s*periodEnd\s*payDate\s*createdAt\s*updatedAt\s*status\s*currency\s*\}/
		);
	});

	it('carries money as an exact decimal and never as a float', () => {
		const run = typeBody('PayrollRun');
		const item = typeBody('PayrollItem');
		const statistics = typeBody('PayrollStatistics');
		const summary = typeBody('PayrollSummary');

		expect(run).toMatch(/totalGross: Decimal!/);
		expect(run).toMatch(/totalDeductions: Decimal!/);
		expect(run).toMatch(/totalNet: Decimal!/);
		expect(item).toMatch(/amount: Decimal!/);
		expect(item).toMatch(/unitPrice: Decimal/);
		expect(statistics).toMatch(/totalGrossPaid: Decimal!/);
		expect(statistics).toMatch(/totalNetPaid: Decimal!/);
		expect(summary).toMatch(/netPay: Decimal!/);
		expect(printed).not.toMatch(/type Payroll(Run|Item|Statistics|Summary) \{[\s\S]*?\b(totalGross|totalNet|totalDeductions|amount|netPay|grossPay): Float/);
	});

	it('does not carry the service’s own working values', () => {
		// The delivered statistics and summary sum in integer cents and strip the accumulators, and the
		// statistics counts a working set of employees. A member for any of them would answer an internal
		// of the calculation — and be absent on every row a caller could reach.
		const statistics = typeBody('PayrollStatistics');
		const summary = typeBody('PayrollSummary');

		for (const body of [statistics, summary]) {
			expect(body).not.toMatch(/^\s*grossCents:/m);
			expect(body).not.toMatch(/^\s*deductionCents:/m);
		}
		expect(statistics).not.toMatch(/^\s*employees:/m);
		// The summary copies the employee off the line, and the run's lines are loaded without that
		// relation, so the member would be absent wherever it could be read.
		expect(summary).not.toMatch(/^\s*employee:/m);
		expect(summary).toMatch(/employeeId: ID!/);
	});

	it('carries the identifiers of the relations no delivered read joins', () => {
		const run = typeBody('PayrollRun');
		const item = typeBody('PayrollItem');

		// The sign-off is recorded on the row, but no read joins the approving user.
		expect(run).toMatch(/approvedByUserId: ID/);
		expect(run).not.toMatch(/\bapprovedBy: User/);
		// A line is answered by the route that adds it, which loads neither relation.
		expect(item).toMatch(/payrollRunId: ID!/);
		expect(item).toMatch(/employeeId: ID/);
		expect(item).not.toMatch(/\bpayrollRun: PayrollRun/);
		expect(item).not.toMatch(/\bemployee: Employee/);
		// The list read does not join the lines and the node read does, which is what the nullability says.
		expect(run).toMatch(/items: \[PayrollItem!\]\n/);
	});

	it('offers no argument it cannot honour', () => {
		// The controller serves no count route, so this surface states no count field.
		expect(printed).not.toMatch(/payrollRunCount/);
		// The organization is a required argument rather than a filter, because the delivered read
		// refuses to answer without one.
		expect(printed).toMatch(/payrollRuns\([\s\S]*?organizationId: ID!/);
		// No input accepts a status or a total: the status moves only through the workflow routes.
		for (const input of ['CreatePayrollRunInput', 'UpdatePayrollRunInput']) {
			expect(inputBody(input)).not.toMatch(/\bstatus:/);
			expect(inputBody(input)).not.toMatch(/\btotal(Gross|Net|Deductions):/);
		}
		// The line input takes the run from the field rather than from the body.
		expect(inputBody('CreatePayrollItemInput')).not.toMatch(/\bpayrollRunId:/);
	});
});

describe('PayrollRunResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, payrollRunService } = surfaces();

		const connection = await resolver.payrollRuns(ORGANIZATION, undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, through the same service method, with the
		// page size the caller stated passed through as the delivered read's own page size.
		expect(payrollRunService.findAllRuns).toHaveBeenCalledWith({ organizationId: ORGANIZATION, limit: 20 });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FEBRUARY);
	});

	it('keeps the read’s own order and its own page size when the caller states none', async () => {
		const { resolver, payrollRunService } = surfaces();

		const connection = await resolver.payrollRuns(ORGANIZATION);

		// No page size is stated, so the delivered read applies its own default — the same window the REST
		// route answers when its `limit` is absent.
		expect(payrollRunService.findAllRuns).toHaveBeenCalledWith({ organizationId: ORGANIZATION });
		expect(connection.nodes.map((node) => node.id)).toEqual([FEBRUARY, JANUARY]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.payrollRuns(ORGANIZATION, { status: { eq: 'PAID' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([JANUARY]);

		const byCurrency = await resolver.payrollRuns(ORGANIZATION, { currency: { eq: 'USD' } });
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([FEBRUARY]);

		const byPeriod = await resolver.payrollRuns(ORGANIZATION, {
			periodStart: { between: ['2026-01-01T00:00:00.000Z', '2026-01-31T00:00:00.000Z'] }
		});
		expect(byPeriod.nodes.map((node) => node.id)).toEqual([JANUARY]);

		const byNet = await resolver.payrollRuns(ORGANIZATION, { totalNet: { gte: '4000' } });
		expect(byNet.nodes.map((node) => node.id)).toEqual([FEBRUARY]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byPeriod = await resolver.payrollRuns(ORGANIZATION, undefined, [
			{ field: 'periodStart', direction: 'ASC' }
		]);
		expect(byPeriod.nodes.map((node) => node.id)).toEqual([JANUARY, FEBRUARY]);

		const byCurrency = await resolver.payrollRuns(ORGANIZATION, undefined, [
			{ field: 'currency', direction: 'ASC' }
		]);
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([JANUARY, FEBRUARY]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.payrollRuns(ORGANIZATION, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FEBRUARY]);

		const second = await resolver.payrollRuns(ORGANIZATION, undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([JANUARY]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.payrollRuns(ORGANIZATION, undefined, undefined, undefined, 20);

		const last = await resolver.payrollRuns(ORGANIZATION, undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FEBRUARY]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses the organization as a filter, because the delivered read declares it required', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.payrollRuns(ORGANIZATION, { organizationId: { eq: ORGANIZATION } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.payrollRuns(ORGANIZATION, undefined, [{ field: 'notes', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.payrollRuns(ORGANIZATION, undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('PayrollRunResolver — one concept, two protocols, the same operations', () => {
	it('reads one run through the same service method the REST route calls', async () => {
		const { resolver, payrollRunService } = surfaces();

		expect(await resolver.payrollRun(FEBRUARY, ORGANIZATION)).toBe(RUNS[0]);
		expect(payrollRunService.findOneRun).toHaveBeenCalledWith(FEBRUARY, ORGANIZATION);
	});

	it('answers null for a run that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, payrollRunService } = surfaces();
		payrollRunService.findOneRun.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.payrollRun(JANUARY, ORGANIZATION)).toBeNull();
	});

	it('aggregates through the same service method the statistics route calls', async () => {
		const { resolver, payrollRunService } = surfaces();

		const statistics = await resolver.payrollRunStatistics(ORGANIZATION);

		expect(payrollRunService.getStatistics).toHaveBeenCalledWith(ORGANIZATION);
		expect(statistics[0].totalNetPaid).toBe(2500);
	});

	it('breaks a run down through the same service method the summary route calls', async () => {
		const { resolver, payrollRunService } = surfaces();

		const summary = await resolver.payrollRunSummary(FEBRUARY, ORGANIZATION);

		expect(payrollRunService.getSummaryByRun).toHaveBeenCalledWith(FEBRUARY, ORGANIZATION);
		expect(summary[0].employeeId).toBe(EMPLOYEE);
	});

	it('opens a run through the same service method the REST route calls', async () => {
		const { resolver, payrollRunService } = surfaces();

		await resolver.createPayrollRun({
			organizationId: ORGANIZATION,
			periodStart: new Date('2026-02-01T00:00:00.000Z'),
			periodEnd: new Date('2026-02-28T00:00:00.000Z'),
			payDate: new Date('2026-03-01T00:00:00.000Z'),
			frequency: PayrollFrequencyEnum.MONTHLY,
			currency: 'USD'
		});

		expect(payrollRunService.createRun).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, currency: 'USD' })
		);
		// The status and the totals are never stated by a caller.
		expect(payrollRunService.createRun.mock.calls[0][0]).not.toHaveProperty('status');
		expect(payrollRunService.createRun.mock.calls[0][0]).not.toHaveProperty('totalNet');
	});

	it('edits a run through the same service method the REST route calls', async () => {
		const { resolver, payrollRunService } = surfaces();

		await resolver.updatePayrollRun({ id: FEBRUARY, organizationId: ORGANIZATION, notes: 'Corrected' });

		expect(payrollRunService.updateRun).toHaveBeenCalledWith(FEBRUARY, ORGANIZATION, { notes: 'Corrected' });
	});

	it('moves a run through each workflow state with the same service methods the REST routes call', async () => {
		const { resolver, payrollRunService } = surfaces();

		await resolver.submitPayrollRun(FEBRUARY, ORGANIZATION);
		expect(payrollRunService.submitForApproval).toHaveBeenCalledWith(FEBRUARY, ORGANIZATION);

		await resolver.approvePayrollRun(FEBRUARY, ORGANIZATION);
		expect(payrollRunService.approve).toHaveBeenCalledWith(FEBRUARY, ORGANIZATION);

		await resolver.processPayrollRun(FEBRUARY, ORGANIZATION);
		expect(payrollRunService.process).toHaveBeenCalledWith(FEBRUARY, ORGANIZATION);

		await resolver.cancelPayrollRun(FEBRUARY, ORGANIZATION);
		expect(payrollRunService.cancel).toHaveBeenCalledWith(FEBRUARY, ORGANIZATION);
	});

	it('adds a line through the same service method the REST route calls, with the run from the field', async () => {
		const { resolver, payrollRunService } = surfaces();

		const answer = await resolver.addPayrollRunItem(FEBRUARY, {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			type: PayrollItemTypeEnum.BASIC_SALARY,
			category: PayrollItemCategoryEnum.EARNING,
			amount: 5000
		});

		expect(payrollRunService.addItem).toHaveBeenCalledWith(
			FEBRUARY,
			expect.objectContaining({ employeeId: EMPLOYEE, amount: 5000 })
		);
		// The run is the field's own argument and is never carried into the body, so a caller cannot post
		// a line into a run it did not name.
		expect(payrollRunService.addItem.mock.calls[0][0]).toBe(FEBRUARY);
		expect(answer).toBe(ITEM_ROW);
	});

	it('removes a line through the same service method the REST route calls', async () => {
		const { resolver, payrollRunService } = surfaces();

		expect(await resolver.removePayrollRunItem(FEBRUARY, ITEM, ORGANIZATION)).toBe(true);
		expect(payrollRunService.removeItem).toHaveBeenCalledWith(FEBRUARY, ITEM, ORGANIZATION);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, payrollRunService } = surfaces();
		const refusal = new Error('Only an approved payroll run can be processed, this one is DRAFT');

		payrollRunService.process.mockRejectedValueOnce(refusal);

		await expect(resolver.processPayrollRun(FEBRUARY, ORGANIZATION)).rejects.toBe(refusal);
	});
});

describe('PayrollRunResolver — the lines across runs, and editing one', () => {
	it('declares the cross-run line list as a connection and the edit as answering the line', () => {
		expect(printed).toMatch(/payrollItems\([^)]*organizationId: ID![^)]*\): PayrollItemConnection!/);
		expect(printed).toMatch(
			/updatePayrollItem\(id: ID!, itemId: ID!, input: UpdatePayrollItemInput!\): PayrollItem!/
		);
		// The run and the line are identifiers, never input members, and no total can be stated.
		expect(inputBody('UpdatePayrollItemInput')).not.toMatch(/payrollRunId|totalGross|totalNet/);
		expect(inputBody('UpdatePayrollItemInput')).toMatch(/organizationId: ID!/);
		expect(inputBody('UpdatePayrollItemInput')).toMatch(/amount: Decimal\n/);
	});

	it('reads the lines through the same service method the items route calls', async () => {
		const { resolver, payrollRunService } = surfaces();

		const none = undefined;
		const connection = await resolver.payrollItems(ORGANIZATION, FEBRUARY, none, none, none, none, 20);

		expect(payrollRunService.findItems).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			payrollRunId: FEBRUARY,
			limit: 20
		});
		expect(connection.nodes.map((node) => node.id)).toEqual([ITEM]);

		const controller = new PayrollRunController(payrollRunService as never);
		await controller.findItems({ organizationId: ORGANIZATION, employeeId: EMPLOYEE } as never);
		expect(payrollRunService.findItems).toHaveBeenLastCalledWith({
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE
		});
	});

	it('edits a line through the route’s service method, with the run and the line as identifiers', async () => {
		const { resolver, payrollRunService } = surfaces();

		await resolver.updatePayrollItem(FEBRUARY, ITEM, { organizationId: ORGANIZATION, amount: 5100 });
		expect(payrollRunService.updateItem).toHaveBeenCalledWith(FEBRUARY, ITEM, ORGANIZATION, { amount: 5100 });

		const controller = new PayrollRunController(payrollRunService as never);
		const body = { organizationId: ORGANIZATION, description: 'Corrected' };
		await controller.updateItem(FEBRUARY, ITEM, body as never);
		expect(payrollRunService.updateItem).toHaveBeenLastCalledWith(
			FEBRUARY,
			ITEM,
			ORGANIZATION,
			expect.objectContaining({ description: 'Corrected', amount: undefined })
		);
	});

	it('states the view grant on the list and the edit grant on the edit, as their routes do', () => {
		expect(permissionOfField('payrollItems')).toEqual([PermissionsEnum.ORG_PAYROLL_VIEW]);
		expect(permissionOfField('updatePayrollItem')).toEqual([PermissionsEnum.ORG_PAYROLL_EDIT]);
	});
});

describe('PayrollRunService — a line changes only in a draft, and the totals follow it', () => {
	/** The service over scripted repositories, with the totals recomputation observed. */
	function service(
		run: { status: string } & Record<string, unknown>,
		options: { item?: unknown; employees?: number } = {}
	) {
		const instance = Object.create(PayrollRunService.prototype) as PayrollRunService;
		const items = {
			findOne: jest.fn().mockResolvedValue(options.item === undefined ? { ...ITEM_ROW } : options.item),
			save: jest.fn().mockImplementation(async (row) => row),
			findAndCount: jest.fn().mockResolvedValue([[ITEM_ROW], 1])
		};
		const manager = { count: jest.fn().mockResolvedValue(options.employees ?? 1) };
		const recalculateTotals = jest.fn().mockResolvedValue(run);
		Object.assign(instance, {
			typeOrmPayrollItemRepository: items,
			typeOrmRepository: { manager },
			findOneRun: jest.fn().mockResolvedValue(run),
			recalculateTotals
		});

		return { instance, items, manager, recalculateTotals };
	}

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT));
	afterEach(() => jest.restoreAllMocks());

	it('edits a line of a draft run and recomputes the run from its lines', async () => {
		const run = { ...RUNS[1], status: PayrollRunStatusEnum.DRAFT };
		const { instance, items, recalculateTotals } = service(run);

		const saved = await instance.updateItem(FEBRUARY, ITEM, ORGANIZATION, { amount: '5100.50' as never });

		expect(items.findOne).toHaveBeenCalledWith({
			where: { id: ITEM, payrollRunId: FEBRUARY, tenantId: TENANT, organizationId: ORGANIZATION }
		});
		expect(saved.amount).toBe(5100.5);
		expect(recalculateTotals).toHaveBeenCalledWith(expect.anything(), run);
	});

	it('refuses to edit a line of a run that is no longer a draft, and writes nothing', async () => {
		const { instance, items, recalculateTotals } = service({ ...RUNS[0], status: PayrollRunStatusEnum.APPROVED });

		await expect(instance.updateItem(JANUARY, ITEM, ORGANIZATION, { amount: 1 })).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(items.save).not.toHaveBeenCalled();
		expect(recalculateTotals).not.toHaveBeenCalled();
	});

	it('refuses a line that is not in the run, and an employee outside the organization', async () => {
		const draft = { ...RUNS[1], status: PayrollRunStatusEnum.DRAFT };

		const missing = service(draft, { item: null });
		await expect(missing.instance.updateItem(FEBRUARY, ITEM, ORGANIZATION, { amount: 1 })).rejects.toBeInstanceOf(
			NotFoundException
		);

		const stranger = service(draft, { employees: 0 });
		await expect(
			stranger.instance.updateItem(FEBRUARY, ITEM, ORGANIZATION, { employeeId: JANUARY })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(stranger.items.save).not.toHaveBeenCalled();
	});

	it('refuses a member outside the vocabulary or a negative amount, which no DTO checks over GraphQL', async () => {
		const { instance, items } = service({ ...RUNS[1], status: PayrollRunStatusEnum.DRAFT });

		for (const input of [{ category: 'BONUS' }, { type: 'TIP' }, { amount: -1 }, { quantity: 'many' }]) {
			await expect(instance.updateItem(FEBRUARY, ITEM, ORGANIZATION, input as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
		}
		expect(items.save).not.toHaveBeenCalled();
	});

	it('lists lines under the tenant and the organization, narrowed and paged at the store', async () => {
		const { instance, items } = service({ status: PayrollRunStatusEnum.DRAFT });

		const filter = { organizationId: ORGANIZATION, employeeId: EMPLOYEE, page: 2, limit: 500 };
		const page = await instance.findItems(filter);

		expect(page).toEqual({ items: [ITEM_ROW], total: 1 });
		expect(items.findAndCount).toHaveBeenCalledWith({
			where: { tenantId: TENANT, organizationId: ORGANIZATION, employeeId: EMPLOYEE },
			order: { createdAt: 'DESC' },
			skip: 100,
			take: 100
		});
	});

	it('refuses to list without an organization rather than reading the whole tenant', async () => {
		const { instance, items } = service({ status: PayrollRunStatusEnum.DRAFT });

		await expect(instance.findItems({} as never)).rejects.toBeInstanceOf(BadRequestException);
		expect(items.findAndCount).not.toHaveBeenCalled();
	});
});

describe('PayrollRunResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', PayrollRunResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', PayrollRunController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const routes = [
			'getStatistics',
			'findAll',
			'findById',
			'getSummary',
			'create',
			'update',
			'submitForApproval',
			'approve',
			'process',
			'cancel',
			'addItem',
			'removeItem',
			'findItems',
			'updateItem'
		];

		for (const handler of routes) {
			expect([...guardsOfRoute(PayrollRunController, handler), FeatureFlagGuard].sort()).toEqual(
				[...Reflect.getMetadata('__guards__', PayrollRunResolver)].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PayrollRunResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, PayrollRunController)
		);
		expect(permissionOfField('createPayrollRun')).toEqual([PermissionsEnum.ORG_PAYROLL_EDIT]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['payrollRuns', 'findAll'],
			['payrollRun', 'findById'],
			['payrollRunStatistics', 'getStatistics'],
			['payrollRunSummary', 'getSummary'],
			['createPayrollRun', 'create'],
			['updatePayrollRun', 'update'],
			['submitPayrollRun', 'submitForApproval'],
			['approvePayrollRun', 'approve'],
			['processPayrollRun', 'process'],
			['cancelPayrollRun', 'cancel'],
			['addPayrollRunItem', 'addItem'],
			['removePayrollRunItem', 'removeItem'],
			['payrollItems', 'findItems'],
			['updatePayrollItem', 'updateItem']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(PayrollRunController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('keeps the prepare, approve and read grants apart, as the routes do', () => {
		// The person who prepares a payroll run should not be able to approve it unaided: the two
		// operations that move money state the approve grant of their own.
		for (const field of ['approvePayrollRun', 'processPayrollRun']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_PAYROLL_APPROVE]);
		}
		for (const field of ['payrollRuns', 'payrollRun', 'payrollRunStatistics', 'payrollRunSummary']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_PAYROLL_VIEW]);
		}
		// Everything else runs under the controller's class-level edit grant, which is what its own route
		// runs under.
		for (const field of [
			'createPayrollRun',
			'updatePayrollRun',
			'submitPayrollRun',
			'cancelPayrollRun',
			'addPayrollRunItem',
			'removePayrollRunItem'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_PAYROLL_EDIT]);
		}
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
		getHandler: () => (PayrollRunResolver.prototype as never)[field],
		getClass: () => PayrollRunResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('PayrollRunResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, PayrollRunResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', PayrollRunResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('payrollRuns')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('payrollRuns');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('payrollRuns'))).resolves.toBe(true);
	});
});
