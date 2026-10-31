import '../../../core/entities/internal';

import { IOrganizationUpdateInput } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { ApiErrorCode } from '../../../core/errors/api-error-codes';
import { ApiException } from '../../../core/errors/api-exception';
import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationUpdateCommand } from '../organization.update.command';
import { OrganizationUpdateHandler } from './organization.update.handler';

/**
 * The update coerced every `show_*` flag whether or not the input carried it: `!!undefined` turned the unsent
 * "off by default" flags off and `undefined !== false` turned the unsent "on by default" flags on, so a partial
 * update (only the name, from the GraphQL mutation or a PUT with a subset of fields) reset the public profile
 * settings. Only the flags the input carries must be written.
 */
describe('OrganizationUpdateHandler — public profile flags', () => {
	const fixture = createTenantFixture();
	const stored = {
		id: 'org-1',
		name: 'Org',
		tenantId: fixture.tenantId,
		show_profits: true,
		show_clients: false,
		contact: null
	};

	let restore: () => void;
	let organizationService: { findOneByIdString: jest.Mock; create: jest.Mock; update: jest.Mock };
	let self: Record<string, unknown>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		organizationService = {
			findOneByIdString: jest.fn().mockResolvedValue(stored),
			create: jest.fn(async (entity) => entity),
			update: jest.fn()
		};
		self = {
			organizationService,
			activityLogService: {},
			moduleRef: { get: jest.fn() },
			logger: { error: jest.fn() }
		};
		self.update = (OrganizationUpdateHandler.prototype as any).update.bind(self);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const update = (input: Partial<IOrganizationUpdateInput>) =>
		OrganizationUpdateHandler.prototype.execute.call(
			self,
			new OrganizationUpdateCommand('org-1', input as IOrganizationUpdateInput)
		);

	const saved = () => organizationService.create.mock.calls[0][0];

	it('does not write the flags a partial update did not send', async () => {
		await update({ name: 'Renamed' });

		const written = saved();
		expect(written).toMatchObject({ id: 'org-1', name: 'Renamed' });
		for (const flag of [
			'show_profits',
			'show_bonuses_paid',
			'show_income',
			'show_total_hours',
			'show_projects_count',
			'show_minimum_project_size',
			'show_clients_count',
			'show_clients',
			'show_employees_count'
		]) {
			expect(written).not.toHaveProperty(flag);
		}
	});

	it('still writes (and coerces) the flags the input carries', async () => {
		await update({ show_profits: false, show_clients: true, show_income: null, show_projects_count: null });

		expect(saved()).toMatchObject({
			show_profits: false,
			show_clients: true,
			show_income: false,
			show_projects_count: true
		});
	});
});

/**
 * Issue #9872 — turning screen capture on for an EEA/UK organization takes the admin's acknowledgement, recorded
 * on the organization (who, when) in the same write, and in its activity log (with the tenant). Every other
 * change, and every organization outside the EEA and the UK, behaves as before.
 */
describe('OrganizationUpdateHandler — screen capture acknowledgement', () => {
	const fixture = createTenantFixture();
	const ALL = { lawfulBasis: true, employeeNotice: true, worksCouncil: true };

	let restore: () => void;
	let organizationService: { findOneByIdString: jest.Mock; create: jest.Mock; update: jest.Mock };
	let activityLogService: { create: jest.Mock };
	let self: Record<string, unknown>;

	const given = (stored: Record<string, unknown>) => {
		organizationService.findOneByIdString.mockResolvedValue({
			id: 'org-1',
			name: 'Org',
			tenantId: fixture.tenantId,
			contact: null,
			...stored
		});
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(fixture.user.id);
		organizationService = {
			findOneByIdString: jest.fn(),
			create: jest.fn(async (entity) => entity),
			update: jest.fn()
		};
		activityLogService = { create: jest.fn().mockResolvedValue({}) };
		self = {
			organizationService,
			activityLogService,
			moduleRef: { get: jest.fn() },
			logger: { error: jest.fn() }
		};
		self.update = (OrganizationUpdateHandler.prototype as any).update.bind(self);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const update = (input: Record<string, unknown>) =>
		OrganizationUpdateHandler.prototype.execute.call(
			self,
			new OrganizationUpdateCommand('org-1', input as unknown as IOrganizationUpdateInput)
		);

	const saved = () => organizationService.create.mock.calls[0][0];

	it('refuses turning capture on for an EEA organization without the acknowledgement, and saves nothing', async () => {
		given({ allowScreenshotCapture: false, regionCode: 'de', timeZone: 'Europe/Berlin' });

		await expect(update({ allowScreenshotCapture: true })).rejects.toMatchObject({
			code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED,
			details: { missing: ['lawfulBasis', 'employeeNotice', 'worksCouncil'] }
		});
		expect(organizationService.create).not.toHaveBeenCalled();
		expect(activityLogService.create).not.toHaveBeenCalled();
	});

	it('judges the location after the change: moving into the UK while turning capture on asks too', async () => {
		given({ allowScreenshotCapture: false, regionCode: 'en', timeZone: 'America/New_York' });

		await expect(
			update({ allowScreenshotCapture: true, timeZone: 'Europe/London' })
		).rejects.toBeInstanceOf(ApiException);
	});

	it('turns capture on with the acknowledgement, recording who and when in the same write', async () => {
		given({ allowScreenshotCapture: false, regionCode: 'de', timeZone: 'Europe/Berlin' });

		await update({ allowScreenshotCapture: true, screenshotCaptureAcknowledgement: ALL });

		const written = saved();
		expect(written).toMatchObject({
			id: 'org-1',
			allowScreenshotCapture: true,
			screenshotCaptureAcknowledgedByUserId: fixture.user.id
		});
		expect(written.screenshotCaptureAcknowledgedAt).toBeInstanceOf(Date);
		// The acknowledgement itself is request-only, not a column.
		expect(written).not.toHaveProperty('screenshotCaptureAcknowledgement');
		expect(activityLogService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				entityId: 'org-1',
				tenantId: fixture.tenantId,
				data: {
					screenshotCaptureAcknowledgement: expect.objectContaining({
						acknowledgedByUserId: fixture.user.id,
						tenantId: fixture.tenantId
					})
				}
			})
		);
	});

	it('keeps an organization that already captures as it is: re-saving it asks nothing', async () => {
		given({ allowScreenshotCapture: true, regionCode: 'de', timeZone: 'Europe/Berlin' });

		await update({ name: 'Renamed', allowScreenshotCapture: true });

		expect(saved()).toMatchObject({ name: 'Renamed', allowScreenshotCapture: true });
		expect(saved()).not.toHaveProperty('screenshotCaptureAcknowledgedAt');
		expect(activityLogService.create).not.toHaveBeenCalled();
	});

	it('never asks to turn capture off', async () => {
		given({ allowScreenshotCapture: true, regionCode: 'de', timeZone: 'Europe/Berlin' });

		await update({ allowScreenshotCapture: false });

		expect(saved()).toMatchObject({ allowScreenshotCapture: false });
	});

	it('asks nothing outside the EEA and the UK, as before', async () => {
		given({ allowScreenshotCapture: false, regionCode: 'en', timeZone: 'America/New_York' });

		await update({ allowScreenshotCapture: true });

		expect(saved()).toMatchObject({ allowScreenshotCapture: true });
		expect(saved()).not.toHaveProperty('screenshotCaptureAcknowledgedByUserId');
	});

	it('never takes the record from the body', async () => {
		given({ allowScreenshotCapture: true, regionCode: 'en', timeZone: 'America/New_York' });

		await update({
			name: 'Renamed',
			screenshotCaptureAcknowledgedAt: '2020-01-01T00:00:00.000Z',
			screenshotCaptureAcknowledgedByUserId: 'someone-else'
		});

		expect(saved()).not.toHaveProperty('screenshotCaptureAcknowledgedAt');
		expect(saved()).not.toHaveProperty('screenshotCaptureAcknowledgedByUserId');
	});
});
