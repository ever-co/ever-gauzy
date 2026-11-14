import '../entities/internal';

import { NotFoundException } from '@nestjs/common';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { RequestContext } from '../context/request-context';
import { redactDatabaseError, safeErrorMessage } from '../errors/database-error';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

/**
 * The hard delete every CRUD service runs (`CrudService.delete`, `TenantAwareCrudService.delete`):
 *
 * - `withDeleted: true` deletes a soft-deleted row too. TypeORM's delete never filters such rows out; MikroORM applies
 *   its soft-delete filter to a native delete as it does to a read, so a soft-deleted row could not be deleted there
 *   at all. The option lifts the filter for that statement, and changes nothing without it.
 * - A failed statement is answered as before (404, the same body), with the driver's error as the exception's `cause`,
 *   so a caller can tell a refused delete (a row other rows still reference) from a missing row.
 *
 * `task.service.delete.dual-orm.spec.ts` runs both on a database through both ORMs.
 */

class RowService extends CrudService<never> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as never, mikroOrmRepository as never);
	}
}

class TenantRowService extends TenantAwareCrudService<never> {
	constructor() {
		super(
			{ metadata: { hasColumnWithPropertyPath: (column: string) => column === 'tenantId' } } as never,
			{} as never
		);
	}
}

/** A refusal as TypeORM raises it on Postgres for a row another row still references, with its bound values. */
const referencedRow = () =>
	Object.assign(new Error('update or delete on table "task" violates foreign key constraint'), {
		name: 'QueryFailedError',
		code: '23503',
		query: 'DELETE FROM "task" WHERE "id" = $1 AND "createdBy" = $2',
		parameters: ['row-1', 'alice@example.com']
	});

describe('CrudService.delete', () => {
	afterEach(() => jest.restoreAllMocks());

	const mikroOrm = () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		const nativeDelete = jest.fn(async () => 1);
		return { service: new RowService({}, { nativeDelete }), nativeDelete };
	};

	it('lifts the MikroORM soft-delete filter for the statement when asked to delete soft-deleted rows too', async () => {
		const { service, nativeDelete } = mikroOrm();

		await expect(service.delete('row-1', { withDeleted: true })).resolves.toEqual({ affected: 1 });

		expect(nativeDelete).toHaveBeenCalledWith(
			{ id: 'row-1' },
			expect.objectContaining({ filters: { [SOFT_DELETABLE_FILTER]: false } })
		);
	});

	it('keeps the filter on MikroORM otherwise, as before', async () => {
		const { service, nativeDelete } = mikroOrm();

		await service.delete('row-1');
		await service.delete({ id: 'row-1' } as never, { withDeleted: false });

		for (const [, options] of nativeDelete.mock.calls as unknown as Array<[unknown, { filters?: unknown }]>) {
			expect(options.filters).toBeUndefined();
		}
	});

	it('hands TypeORM the criteria alone, with or without the option (its delete never filters soft-deleted rows)', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const remove = jest.fn(async () => ({ affected: 1, raw: [] }));
		const service = new RowService({ delete: remove }, {});

		await service.delete('row-1', { withDeleted: true });
		await service.delete('row-2');

		expect(remove.mock.calls).toEqual([['row-1'], ['row-2']]);
	});

	it('answers a failed statement with the same 404 as before, the driver error as its cause', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const failure = referencedRow();
		const service = new RowService({ delete: jest.fn(async () => Promise.reject(failure)) }, {});

		const error = await service.delete('row-1').catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NotFoundException);
		// The description is the redacted message, as it always was; the driver's own words stay out of the answer.
		expect((error as NotFoundException).getResponse()).toEqual({
			statusCode: 404,
			message: 'The record was not found',
			error: safeErrorMessage(failure)
		});
		expect(JSON.stringify((error as NotFoundException).getResponse())).not.toContain('violates');
		expect((error as NotFoundException).cause).toBe(failure);
	});
});

describe('TenantAwareCrudService.delete', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', tenantId: 'tenant-1' } as never);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(true);
	});

	afterEach(() => jest.restoreAllMocks());

	it('passes withDeleted on with the tenant-scoped criteria, and nothing of the kind without it', async () => {
		const remove = jest.spyOn(CrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
		const service = new TenantRowService();

		await service.delete('row-1', { withDeleted: true });
		await service.delete('row-2');

		expect(remove).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'row-1', tenantId: 'tenant-1' }), {
			withDeleted: true
		});
		expect(remove).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'row-2', tenantId: 'tenant-1' }), {
			withDeleted: false
		});
	});

	it('answers a failed statement with the same 404 body as before, keeping the driver error as its cause', async () => {
		const failure = referencedRow();
		jest.spyOn(CrudService.prototype, 'delete').mockRejectedValue(
			new NotFoundException('The record was not found', { cause: failure, description: 'redacted' })
		);
		const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const service = new TenantRowService();

		const error = await service.delete('row-1').catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(NotFoundException);
		expect((error as NotFoundException).getResponse()).toEqual({
			statusCode: 404,
			message: 'The record was not found',
			error: 'Not Found'
		});
		expect((error as NotFoundException).cause).toBe(failure);
		// The log gets the driver error without its bound values, never the raw error with them.
		expect(logged).toHaveBeenCalledWith('Error during delete operation:', redactDatabaseError(failure));
		expect(JSON.stringify(logged.mock.calls)).not.toContain('alice@example.com');
	});
});
