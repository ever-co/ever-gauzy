/**
 * Load the entity graph FIRST, as the application does: the controller and service reach the entities,
 * whose import through the validators otherwise leaves an entity decorator undefined.
 */
import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { TimeOffRequestController } from './time-off-request.controller';
import { TimeOffRequestService } from './time-off-request.service';

/**
 * #10746: `GET /time-off-request` took the organization from the `data` JSON, which no DTO validates,
 * and listed its requests without checking that the user belongs to it. It now answers 403 for an
 * organization the user is not a member of, like `/time-off-balance`, and 400 for an id that is not a UUID.
 */
describe('TimeOffRequestController.findAll — organization membership', () => {
	const MINE = '11111111-1111-4111-8111-111111111111';
	const THEIRS = '22222222-2222-4222-8222-222222222222';

	let getAllTimeOffRequests: jest.SpyInstance;
	let controller: TimeOffRequestController;

	beforeEach(() => {
		// The membership lookup: a `user_organization` row exists for the caller's own organization only.
		const manager = {
			count: jest.fn(async (_entity, { where }) => (where.organizationId === MINE ? 1 : 0))
		};
		const service = new TimeOffRequestService({ manager } as any, {} as any, {} as any);
		getAllTimeOffRequests = jest.spyOn(service, 'getAllTimeOffRequests').mockResolvedValue({ items: [], total: 0 });
		controller = new TimeOffRequestController(service, {} as any);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		// The user's token names their own organization: the only one the organization boundary lets them name.
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(MINE);
	});

	afterEach(() => jest.restoreAllMocks());

	const list = (findInput: Record<string, unknown>) => controller.findAll({ relations: [], findInput });

	it('answers 403 for an organization the user is not a member of, before listing', async () => {
		await expect(list({ organizationId: THEIRS })).rejects.toBeInstanceOf(ForbiddenException);
		expect(getAllTimeOffRequests).not.toHaveBeenCalled();
	});

	it.each([[{ $ne: MINE }], [[MINE, THEIRS]], ['not-a-uuid']])(
		'answers 400 for an organization id %j that is not a UUID',
		async (organizationId) => {
			await expect(list({ organizationId })).rejects.toBeInstanceOf(BadRequestException);
			expect(getAllTimeOffRequests).not.toHaveBeenCalled();
		}
	);

	it("lists one of the user's own organizations", async () => {
		await list({ organizationId: MINE });

		expect(getAllTimeOffRequests).toHaveBeenCalledWith([], { organizationId: MINE });
	});
});
