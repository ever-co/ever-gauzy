import '../core/entities/internal';

import { TenantAwareCrudService } from '../core/crud';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { InviteService } from './invite.service';

/**
 * `InviteService.findAllInvites` derived the offset as `take * (skip - 1)` whether or not a page
 * size was sent, so a page number alone produced a NaN offset.
 */
describe('InviteService.findAllInvites pagination', () => {
	let restore: () => void;
	let findAll: jest.SpyInstance;
	let service: InviteService;

	beforeEach(() => {
		({ restore } = asTenantUser(createTenantFixture()));
		findAll = jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 });
		service = Object.create(InviteService.prototype);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('does not send a NaN offset when only `skip` is sent', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await service.findAllInvites({ skip: 2 } as any);

		const [filter] = findAll.mock.calls[0];
		expect(filter).not.toHaveProperty('skip');
		expect(filter).not.toHaveProperty('take');
	});

	it('keeps the requested page when `take` is sent', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await service.findAllInvites({ take: 10, skip: 3 } as any);

		expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
	});

	it('starts at the first row when only `take` is sent', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await service.findAllInvites({ take: 10 } as any);

		expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
	});
});
