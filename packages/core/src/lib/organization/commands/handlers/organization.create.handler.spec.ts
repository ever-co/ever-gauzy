/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../../../core/entities/internal';

import { IOrganizationCreateInput } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { ApiErrorCode } from '../../../core/errors/api-error-codes';
import { OrganizationCreateCommand } from '../organization.create.command';
import { OrganizationCreateHandler } from './organization.create.handler';

/**
 * Issue #9872 — a new organization starts with screen capture off. Asking for it on at creation still works;
 * for an organization in the EEA or the UK it takes the admin's acknowledgement, recorded on the row (who,
 * when) and in the activity log (with the tenant). Existing organizations are not touched by any of this.
 */
const TENANT = '00000000-0000-4000-8000-000000000001';
const ADMIN = '00000000-0000-4000-8000-0000000000b1';
const ALL = { lawfulBasis: true, employeeNotice: true, worksCouncil: true };

/** How many `runOutsideOrganizationBoundary` blocks are open: the real helper, counted. */
const mockBoundary = { open: 0 };
jest.mock('../../../core/crud/organization-boundary', () => {
	const actual = jest.requireActual('../../../core/crud/organization-boundary');
	return {
		...actual,
		runOutsideOrganizationBoundary: async (callback: () => Promise<unknown>) => {
			mockBoundary.open++;
			try {
				return await actual.runOutsideOrganizationBoundary(callback);
			} finally {
				mockBoundary.open--;
			}
		}
	};
});

function setup() {
	const organizationService = {
		tableName: 'organization',
		create: jest.fn(async (payload: Record<string, unknown>) => ({ ...payload, id: 'org-1', tenantId: TENANT })),
		update: jest.fn(),
		findOneByIdString: jest.fn(async (id: string) => ({ id })),
		// A create names no stored organization unless a test says so.
		findOneOrFailByIdString: jest.fn().mockResolvedValue({ success: false })
	};
	const activityLogService = { create: jest.fn().mockResolvedValue({}) };
	const contactService = {
		create: jest.fn(async () => ({ id: 'contact-1' })),
		findOneOrFailByIdString: jest.fn().mockResolvedValue({ success: false })
	};
	const handler = new OrganizationCreateHandler(
		{ execute: jest.fn() } as never,
		organizationService as never,
		{ tableName: 'user_organization', create: jest.fn(async () => ({ id: 'membership' })) } as never,
		{ find: jest.fn().mockResolvedValue([]) } as never,
		contactService as never,
		activityLogService as never
	);
	const create = (input: Record<string, unknown>) =>
		handler.execute(
			new OrganizationCreateCommand({ name: 'Acme', currency: 'EUR', ...input } as IOrganizationCreateInput)
		);
	const created = () => organizationService.create.mock.calls[0][0];

	return { organizationService, activityLogService, contactService, create, created };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(ADMIN);
	jest.spyOn(RequestContext, 'hasRole').mockReturnValue(false);
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('OrganizationCreateHandler — screen capture', () => {
	it('creates the organization with screen capture off when the request does not ask for it', async () => {
		const { create, created, activityLogService } = setup();

		await create({ timeZone: 'Europe/Berlin' });

		expect(created()).toMatchObject({ allowScreenshotCapture: false });
		expect(created()).not.toHaveProperty('screenshotCaptureAcknowledgedAt');
		expect(activityLogService.create).not.toHaveBeenCalled();
	});

	it('keeps an explicit "off"', async () => {
		const { create, created } = setup();

		await create({ allowScreenshotCapture: false });

		expect(created()).toMatchObject({ allowScreenshotCapture: false });
	});

	it('turns it on when asked, outside the EEA and the UK, without asking more (as before)', async () => {
		const { create, created } = setup();

		await create({ allowScreenshotCapture: true, timeZone: 'America/New_York' });

		expect(created()).toMatchObject({ allowScreenshotCapture: true });
		expect(created()).not.toHaveProperty('screenshotCaptureAcknowledgedByUserId');
	});

	it('refuses to create an EEA organization with capture on without the acknowledgement, keeping the code', async () => {
		const { create, organizationService } = setup();

		await expect(create({ allowScreenshotCapture: true, timeZone: 'Europe/Berlin' })).rejects.toMatchObject({
			code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED,
			details: { missing: ['lawfulBasis', 'employeeNotice', 'worksCouncil'] }
		});
		expect(organizationService.create).not.toHaveBeenCalled();
	});

	it('reads the country of the contact, so a UK address asks too', async () => {
		const { create } = setup();

		await expect(create({ allowScreenshotCapture: true, contact: { country: 'GB' } })).rejects.toMatchObject({
			code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED
		});
	});

	it('creates an EEA organization with capture on when acknowledged, recording who, when and the tenant', async () => {
		const { create, created, activityLogService } = setup();
		// The new organization is outside the caller's token organization: the log entry crosses the boundary.
		let boundaryOpenAtLog = 0;
		activityLogService.create.mockImplementation(async () => {
			boundaryOpenAtLog = mockBoundary.open;
			return {};
		});

		await create({
			allowScreenshotCapture: true,
			timeZone: 'Europe/Berlin',
			screenshotCaptureAcknowledgement: ALL
		});

		expect(created()).toMatchObject({ allowScreenshotCapture: true, screenshotCaptureAcknowledgedByUserId: ADMIN });
		expect(created().screenshotCaptureAcknowledgedAt).toBeInstanceOf(Date);
		expect(created()).not.toHaveProperty('screenshotCaptureAcknowledgement');
		expect(activityLogService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				entityId: 'org-1',
				tenantId: TENANT,
				data: {
					screenshotCaptureAcknowledgement: expect.objectContaining({
						acknowledgedByUserId: ADMIN,
						tenantId: TENANT
					})
				}
			})
		);
		expect(boundaryOpenAtLog).toBeGreaterThan(0);
	});

	it('never takes the record from the body', async () => {
		const { create, created } = setup();

		await create({
			screenshotCaptureAcknowledgedAt: '2020-01-01T00:00:00.000Z',
			screenshotCaptureAcknowledgedByUserId: 'someone-else'
		});

		expect(created()).not.toHaveProperty('screenshotCaptureAcknowledgedAt');
		expect(created()).not.toHaveProperty('screenshotCaptureAcknowledgedByUserId');
	});

	it('looks nothing up for a create without an id', async () => {
		const { create, organizationService } = setup();

		await create({});

		expect(organizationService.findOneOrFailByIdString).not.toHaveBeenCalled();
	});

	it('treats an id that names no organization of this tenant as a new organization', async () => {
		const { create, created, organizationService } = setup();

		await create({ id: 'org-new' });

		expect(organizationService.findOneOrFailByIdString).toHaveBeenCalledWith('org-new', {
			relations: { contact: true }
		});
		expect(created()).toMatchObject({ allowScreenshotCapture: false });
	});

	describe('a create that names an existing organization, which the save updates', () => {
		const stored = (values: Record<string, unknown>) => ({
			success: true,
			record: { id: 'org-9', tenantId: TENANT, contact: null, ...values }
		});

		it('asks for the acknowledgement when it turns capture on for a stored EEA/UK organization', async () => {
			const { create, organizationService } = setup();
			organizationService.findOneOrFailByIdString.mockResolvedValue(
				stored({ allowScreenshotCapture: false, contact: { country: 'GB' } })
			);

			// No location in the request: the stored one is what counts.
			await expect(create({ id: 'org-9', allowScreenshotCapture: true })).rejects.toMatchObject({
				code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED
			});
			expect(organizationService.create).not.toHaveBeenCalled();
		});

		it('keeps the stored value when the request does not set one, instead of the new-organization default', async () => {
			const { create, created, activityLogService, organizationService } = setup();
			organizationService.findOneOrFailByIdString.mockResolvedValue(
				stored({ allowScreenshotCapture: true, timeZone: 'Europe/Berlin' })
			);

			await create({ id: 'org-9' });

			// Not the new-organization default, and not the stored value written back: the column is left alone.
			expect(created().allowScreenshotCapture).toBeUndefined();
			expect(created()).not.toHaveProperty('screenshotCaptureAcknowledgedAt');
			expect(activityLogService.create).not.toHaveBeenCalled();
		});

		it('never writes a stale stored value back, so a save racing one that turns capture off cannot undo it', async () => {
			const { create, created, organizationService } = setup();
			organizationService.findOneOrFailByIdString.mockResolvedValue(
				stored({ allowScreenshotCapture: true, timeZone: 'Europe/Berlin' })
			);

			await create({ id: 'org-9', allowScreenshotCapture: true });

			expect(created().allowScreenshotCapture).toBeUndefined();
		});

		it('writes a change the request makes', async () => {
			const { create, created, organizationService } = setup();
			organizationService.findOneOrFailByIdString.mockResolvedValue(
				stored({ allowScreenshotCapture: true, timeZone: 'Europe/Berlin' })
			);

			await create({ id: 'org-9', allowScreenshotCapture: false });

			expect(created()).toMatchObject({ allowScreenshotCapture: false });
		});
	});

	describe('a contact the request names by id', () => {
		it('counts with the country it has: a UK contact asks for the acknowledgement', async () => {
			const { create, contactService, organizationService } = setup();
			contactService.findOneOrFailByIdString.mockResolvedValue({ success: true, record: { country: 'GB' } });

			await expect(
				create({ allowScreenshotCapture: true, timeZone: 'America/New_York', contact: { id: 'contact-uk' } })
			).rejects.toMatchObject({ code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED });
			expect(contactService.findOneOrFailByIdString).toHaveBeenCalledWith('contact-uk');
			expect(organizationService.create).not.toHaveBeenCalled();
		});

		it('is not read when capture stays off', async () => {
			const { create, contactService } = setup();

			await create({ contact: { id: 'contact-uk' } });

			expect(contactService.findOneOrFailByIdString).not.toHaveBeenCalled();
		});
	});
});
