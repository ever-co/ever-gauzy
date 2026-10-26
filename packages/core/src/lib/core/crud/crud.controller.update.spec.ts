import { CrudController } from './crud.controller';

/**
 * The inherited `PUT /:id` of every controller built on `CrudController` hands its raw body to the service.
 * The service keeps the row in the caller's tenant (SEC-A-03), but two members of a body are never an edit:
 * `deletedAt` retires the row past whatever guards its delete route runs, and `id` rewrites the primary key.
 */
describe('CrudController.update — the inherited PUT /:id', () => {
	class RowController extends CrudController<any> {
		constructor(service: any) {
			super(service);
		}
	}

	it('hands the service the edit, without the members a body may not write', async () => {
		const update = jest.fn(async () => ({ affected: 1 }));
		const controller = new RowController({ update } as any);

		await controller.update('row-1', {
			name: 'renamed',
			deletedAt: '2026-10-15T00:00:00.000Z',
			id: 'row-2',
			tenantId: 'tenant-b',
			tenant: { id: 'tenant-b' }
		} as any);

		expect(update).toHaveBeenCalledWith('row-1', { name: 'renamed' });
	});
});
