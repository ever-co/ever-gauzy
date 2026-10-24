import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { SharedEntityService } from './shared-entity.service';
import { SharedEntity } from './shared-entity.entity';

const AUTHOR = 'a0000000-0000-4000-8000-00000000000a';
const OTHER = 'b0000000-0000-4000-8000-00000000000b';
const SHARE_ID = 'c0000000-0000-4000-8000-00000000000c';

/** A share as stored: its token reads the record it names without signing in. */
function share(createdByUserId = AUTHOR): SharedEntity {
	return { id: SHARE_ID, token: 'live-share-token', createdByUserId, entity: 'Invoice' } as unknown as SharedEntity;
}

/** The service without its constructor: only the methods under test and the base methods they call run. */
function serviceUnderTest(stored: SharedEntity = share()) {
	const service = Object.create(SharedEntityService.prototype) as SharedEntityService;
	jest.spyOn(service, 'findOneByIdString').mockResolvedValue(stored);
	jest.spyOn(service, 'find').mockResolvedValue([stored]);
	const base = Object.getPrototypeOf(SharedEntityService.prototype);
	const removed = jest.spyOn(base, 'delete').mockResolvedValue({ affected: 1, raw: [] });
	const retired = jest.spyOn(base, 'softRemove').mockResolvedValue(stored);
	const restored = jest.spyOn(base, 'softRecover').mockResolvedValue(stored);

	return { service, removed, retired, restored };
}

function signedInAs(userId: string, permissions: PermissionsEnum[] = []) {
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => permissions.includes(permission));
}

/**
 * Every member of the tenant reaches the share routes, and a share's token reads the invoice, payment or
 * candidate it names without signing in. `GET /shared-entities` used to answer every share with its token, so a
 * member could read records they hold no permission for, and change or withdraw links they did not issue.
 */
describe('SharedEntityService — a share is its author’s', () => {
	afterEach(() => jest.restoreAllMocks());

	it('shows the token to the author and to an organization administrator only', () => {
		const { service } = serviceUnderTest();

		signedInAs(AUTHOR);
		expect(service.withTokenForManager(share()).token).toBe('live-share-token');

		signedInAs(OTHER, [PermissionsEnum.ALL_ORG_EDIT]);
		expect(service.withTokenForManager(share()).token).toBe('live-share-token');

		signedInAs(OTHER, [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW]);
		const seen = service.withTokenForManager(share());
		expect(seen).not.toHaveProperty('token');
		expect(seen).toEqual(expect.objectContaining({ id: SHARE_ID, entity: 'Invoice' }));
	});

	it('refuses another member’s removal, withdrawal, restoration and edit of a share', async () => {
		const { service, removed, retired, restored } = serviceUnderTest();
		signedInAs(OTHER);

		await expect(service.delete(SHARE_ID)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.softRemove(SHARE_ID)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.softRecover(SHARE_ID)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.update(SHARE_ID, { isActive: false } as never)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.delete({ entityId: SHARE_ID } as never)).rejects.toBeInstanceOf(ForbiddenException);

		expect(removed).not.toHaveBeenCalled();
		expect(retired).not.toHaveBeenCalled();
		expect(restored).not.toHaveBeenCalled();
	});

	it('lets the author withdraw and restore their own share, finding a withdrawn one among deleted rows', async () => {
		const { service, removed, retired, restored } = serviceUnderTest();
		signedInAs(AUTHOR);

		await service.delete(SHARE_ID);
		await service.softRemove(SHARE_ID);
		await service.softRecover(SHARE_ID);

		expect(removed).toHaveBeenCalledWith(SHARE_ID, undefined);
		expect(retired).toHaveBeenCalled();
		expect(restored).toHaveBeenCalled();
		expect(service.findOneByIdString).toHaveBeenLastCalledWith(SHARE_ID, { withDeleted: true });
	});
});
