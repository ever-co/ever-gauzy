/**
 * `@gauzy/core` is mocked so this suite stays a unit test: importing it for real pulls the whole entity
 * graph (and ESM-only dependencies this package's jest config does not transform).
 */
jest.mock('../../services/videos.service', () => ({ VideosService: class {} }));
jest.mock('@gauzy/core', () => ({
	BaseQueryDTO: class {},
	RequestContext: {
		hasPermission: jest.fn(),
		currentEmployeeId: jest.fn()
	},
	// The ownership rule itself lives in core, with its own spec (own-upload.helper.spec.ts); what
	// matters here is that this handler delegates to it, with the same message it uses for "not found".
	assertCallerOwnsUpload: jest.fn()
}));

import { NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { assertCallerOwnsUpload } from '@gauzy/core';
import { GetVideosQueryHandler } from './get-videos.handler';
import { GetVideoQueryHandler } from './get-video.handler';
import { GetVideosQuery } from '../get-videos.query';
import { GetVideoQuery } from '../get-video.query';

const TENANT_ID = '3f9b0d11-9d24-4a6e-9a1a-6c5a2d7a5f01';
const ORGANIZATION_ID = 'c2b7e6c0-3f7d-4a3e-9c2b-1f0e6d5a4b02';
const OWN_EMPLOYEE_ID = '5d2c1b0a-7e8f-4c3d-9a1b-0f2e3d4c5b04';
const VICTIM_EMPLOYEE_ID = '9c8b7a6d-5e4f-4a3b-9c2d-1e0f9a8b7c06';
const VIDEO_ID = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e05';

const actAs = (caller: { employeeId: string | null; canChangeSelectedEmployee: boolean }) => {
	(RequestContext.hasPermission as jest.Mock).mockImplementation(
		(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE && caller.canChangeSelectedEmployee
	);
	(RequestContext.currentEmployeeId as jest.Mock).mockReturnValue(caller.employeeId);
};

/**
 * Videos carry `uploadedById`, not `employeeId`, so the per-employee restriction in
 * TenantAwareCrudService never applies to them and each handler has to scope for itself.
 */
describe('videos employee scoping', () => {
	afterEach(() => jest.clearAllMocks());

	describe('list', () => {
		let paginate: jest.Mock;
		let handler: GetVideosQueryHandler;

		beforeEach(() => {
			paginate = jest.fn().mockResolvedValue({ items: [], total: 0 });
			handler = new GetVideosQueryHandler({ paginate } as any);
		});

		const run = (where: Record<string, unknown>) =>
			handler.execute(new GetVideosQuery({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, where } as any));

		it('keeps the uploader filter when the client asks for another employee', async () => {
			actAs({ employeeId: OWN_EMPLOYEE_ID, canChangeSelectedEmployee: false });

			await run({ uploadedById: VICTIM_EMPLOYEE_ID });

			expect(paginate.mock.calls[0][0].where).toEqual(expect.objectContaining({ uploadedById: OWN_EMPLOYEE_ID }));
		});

		it('keeps the tenant and organization the server resolved', async () => {
			actAs({ employeeId: OWN_EMPLOYEE_ID, canChangeSelectedEmployee: false });

			await run({ tenantId: 'a-tenant-of-someone-else', organizationId: 'another-organization' });

			expect(paginate.mock.calls[0][0].where).toEqual(
				expect.objectContaining({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })
			);
		});

		it('still lets a client filter narrow the result on a field the server does not set', async () => {
			actAs({ employeeId: OWN_EMPLOYEE_ID, canChangeSelectedEmployee: false });

			await run({ title: 'standup' });

			expect(paginate.mock.calls[0][0].where).toEqual(expect.objectContaining({ title: 'standup' }));
		});

		it('answers an empty page for a caller with no employee identity', async () => {
			actAs({ employeeId: null, canChangeSelectedEmployee: false });

			await expect(run({ uploadedById: VICTIM_EMPLOYEE_ID })).resolves.toEqual({ items: [], total: 0 });
			expect(paginate).not.toHaveBeenCalled();
		});
	});

	describe('by id', () => {
		it('hands the record to the shared ownership check before returning it', async () => {
			const video = { id: VIDEO_ID, uploadedById: VICTIM_EMPLOYEE_ID };
			(assertCallerOwnsUpload as jest.Mock).mockReturnValue(video);
			const handler = new GetVideoQueryHandler({ findOneByIdString: jest.fn().mockResolvedValue(video) } as any);

			await expect(handler.execute(new GetVideoQuery(VIDEO_ID, {}))).resolves.toBe(video);
			expect(assertCallerOwnsUpload).toHaveBeenCalledWith(video, `Video with ID ${VIDEO_ID} not found.`);
		});

		it('lets the check refusal through', async () => {
			(assertCallerOwnsUpload as jest.Mock).mockImplementation(() => {
				throw new NotFoundException('nope');
			});
			const handler = new GetVideoQueryHandler({
				findOneByIdString: jest.fn().mockResolvedValue({ id: VIDEO_ID, uploadedById: VICTIM_EMPLOYEE_ID })
			} as any);

			await expect(handler.execute(new GetVideoQuery(VIDEO_ID, {}))).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});
