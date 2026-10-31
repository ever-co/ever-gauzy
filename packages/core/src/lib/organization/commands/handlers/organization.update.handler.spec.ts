import '../../../core/entities/internal';

import { EEA_UK_AGENT_RESTRICTION_ERR_MSG, IOrganizationUpdateInput } from '@gauzy/contracts';
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
	let contactService: { findOneOrFailByIdString: jest.Mock };
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
		contactService = { findOneOrFailByIdString: jest.fn().mockResolvedValue({ success: false }) };
		self = {
			organizationService,
			activityLogService,
			contactService,
			moduleRef: { get: jest.fn() },
			logger: { error: jest.fn() }
		};
		const prototype = OrganizationUpdateHandler.prototype as unknown as { update: (...args: unknown[]) => unknown };
		self.update = prototype.update.bind(self);
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

		await expect(update({ allowScreenshotCapture: true, timeZone: 'Europe/London' })).rejects.toBeInstanceOf(
			ApiException
		);
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

		expect(saved()).toMatchObject({ name: 'Renamed' });
		// The stored value sent back is not written: the column keeps what it holds.
		expect(saved()).not.toHaveProperty('allowScreenshotCapture');
		expect(saved()).not.toHaveProperty('screenshotCaptureAcknowledgedAt');
		expect(activityLogService.create).not.toHaveBeenCalled();
	});

	it('cannot turn capture back on by racing a save that turned it off', async () => {
		// Read while capture was still on; another admin turns it off before this save is written.
		given({ allowScreenshotCapture: true, regionCode: 'de', timeZone: 'Europe/Berlin' });

		await update({ name: 'Renamed', allowScreenshotCapture: true });

		// Nothing of this write sets the flag, so the other admin's `false` stays.
		expect(saved()).not.toHaveProperty('allowScreenshotCapture');
	});

	it('reads the stored contact country: a top-level country the write does not store does not skip the check', async () => {
		given({
			allowScreenshotCapture: false,
			regionCode: 'en',
			timeZone: 'America/New_York',
			contact: { country: 'GB' }
		});

		await expect(update({ allowScreenshotCapture: true, country: 'US' })).rejects.toMatchObject({
			code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED
		});
		expect(organizationService.create).not.toHaveBeenCalled();
	});

	it('reads the contact the write carries: moving the address into the EEA while turning capture on asks too', async () => {
		given({
			allowScreenshotCapture: false,
			regionCode: 'en',
			timeZone: 'America/New_York',
			contact: { country: 'US' }
		});

		await expect(update({ allowScreenshotCapture: true, contact: { country: 'DE' } })).rejects.toMatchObject({
			code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED
		});
	});

	it.each([
		['contact: { id }', { contact: { id: 'contact-uk' } }],
		['contactId', { contactId: 'contact-uk' }]
	])('reads the country of a contact the write links by %s: a UK contact asks too', async (_, link) => {
		given({
			allowScreenshotCapture: false,
			regionCode: 'en',
			timeZone: 'America/New_York',
			contactId: 'contact-us',
			contact: { country: 'US' }
		});
		contactService.findOneOrFailByIdString.mockResolvedValue({ success: true, record: { country: 'GB' } });

		await expect(update({ allowScreenshotCapture: true, ...link })).rejects.toMatchObject({
			code: ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED
		});
		expect(contactService.findOneOrFailByIdString).toHaveBeenCalledWith('contact-uk');
		expect(organizationService.create).not.toHaveBeenCalled();
	});

	it('reads no contact when the write links none, or links the current one', async () => {
		given({
			allowScreenshotCapture: false,
			regionCode: 'en',
			timeZone: 'America/New_York',
			contactId: 'contact-us'
		});

		await update({ name: 'Renamed' });
		await update({ allowScreenshotCapture: true, contactId: 'contact-us' });

		expect(contactService.findOneOrFailByIdString).not.toHaveBeenCalled();
	});

	it('never asks to turn capture off', async () => {
		given({ allowScreenshotCapture: true, regionCode: 'de', timeZone: 'Europe/Berlin' });

		await update({ allowScreenshotCapture: false });

		expect(saved()).toMatchObject({ allowScreenshotCapture: false });
		expect(activityLogService.create).not.toHaveBeenCalled();
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

/**
 * Issue #9873 — the agent exit/logout restriction judges the organization's location the way the screen capture
 * check does: from what is stored and what the write stores (region code, time zone, the country of the contact it
 * carries or links by id). A top-level `country` is not stored on the organization, so it changes no decision.
 */
describe('OrganizationUpdateHandler — agent exit/logout restriction location', () => {
	const fixture = createTenantFixture();
	const RESTRICT = { allowAgentAppExit: false, acknowledgeAgentExitLogoutRestriction: true };

	let restore: () => void;
	let organizationService: { findOneByIdString: jest.Mock; create: jest.Mock; update: jest.Mock };
	let activityLogService: { create: jest.Mock };
	let contactService: { findOneOrFailByIdString: jest.Mock };
	let moduleRef: { get: jest.Mock };
	let self: Record<string, unknown>;

	const row = (values: Record<string, unknown>) => ({
		id: 'org-1',
		name: 'Org',
		tenantId: fixture.tenantId,
		allowScreenshotCapture: false,
		contact: null,
		...values
	});
	/** The organization as read before the update and, by default the same, as read back after the save. */
	const given = (stored: Record<string, unknown>, saved: Record<string, unknown> = stored) => {
		organizationService.findOneByIdString.mockResolvedValueOnce(row(stored)).mockResolvedValue(row(saved));
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
		contactService = { findOneOrFailByIdString: jest.fn().mockResolvedValue({ success: false }) };
		// No employee service here: lifting the employees' restrictions shows only as this lookup.
		moduleRef = { get: jest.fn() };
		self = {
			organizationService,
			activityLogService,
			contactService,
			moduleRef,
			logger: { error: jest.fn() }
		};
		const prototype = OrganizationUpdateHandler.prototype as unknown as Record<
			'update' | 'savedLocation',
			(...args: unknown[]) => unknown
		>;
		self.update = prototype.update.bind(self);
		self.savedLocation = prototype.savedLocation.bind(self);
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

	describe.each([
		['no country', {}],
		['an unstored country outside the EEA/UK', { country: 'US' }],
		['an unstored country inside the EEA/UK', { country: 'DE' }]
	])('a request with %s', (_, country) => {
		it('cannot restrict exit for a UK organization', async () => {
			given({ regionCode: 'en', timeZone: 'America/New_York', contact: { country: 'GB' } });

			await expect(update({ ...country, ...RESTRICT })).rejects.toThrow(EEA_UK_AGENT_RESTRICTION_ERR_MSG);
			expect(organizationService.create).not.toHaveBeenCalled();
			expect(activityLogService.create).not.toHaveBeenCalled();
		});

		it('restricts exit for an organization outside the EEA/UK with the acknowledgement, recording it', async () => {
			given({ regionCode: 'en', timeZone: 'America/New_York', contact: { country: 'US' } });

			await update({ ...country, ...RESTRICT });

			expect(organizationService.create).toHaveBeenCalledWith(
				expect.objectContaining({ allowAgentAppExit: false })
			);
			expect(activityLogService.create).toHaveBeenCalledWith(
				expect.objectContaining({ updatedFields: ['allowAgentAppExit'] })
			);
		});

		it('does not move a restricted organization into the EEA/UK, so it saves and lifts nothing', async () => {
			given({
				regionCode: 'en',
				timeZone: 'America/New_York',
				contact: { country: 'US' },
				allowAgentAppExit: false
			});

			await update({ ...country, name: 'Renamed' });

			expect(organizationService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }));
			expect(moduleRef.get).not.toHaveBeenCalled();
		});
	});

	it('counts a contact the write links by id: linking a UK contact while restricting exit is refused', async () => {
		given({ regionCode: 'en', timeZone: 'America/New_York', contactId: 'contact-us', contact: { country: 'US' } });
		contactService.findOneOrFailByIdString.mockResolvedValue({ success: true, record: { country: 'GB' } });

		await expect(update({ contactId: 'contact-uk', ...RESTRICT })).rejects.toThrow(
			EEA_UK_AGENT_RESTRICTION_ERR_MSG
		);
		expect(contactService.findOneOrFailByIdString).toHaveBeenCalledWith('contact-uk');
		expect(organizationService.create).not.toHaveBeenCalled();
	});

	it('counts a contact the write carries: moving it into the EEA while exit stays restricted is refused', async () => {
		given({
			regionCode: 'en',
			timeZone: 'America/New_York',
			contact: { country: 'US' },
			allowAgentAppExit: false
		});

		await expect(update({ contact: { country: 'DE' } })).rejects.toThrow(EEA_UK_AGENT_RESTRICTION_ERR_MSG);
		expect(organizationService.create).not.toHaveBeenCalled();
	});

	it('lifts employee restrictions when a linked contact moves the organization into the EEA/UK', async () => {
		const US = { regionCode: 'en', timeZone: 'America/New_York' };
		given(
			{ ...US, contactId: 'contact-us', contact: { country: 'US' } },
			{ ...US, contactId: 'contact-uk', contact: { country: 'GB' } }
		);
		contactService.findOneOrFailByIdString.mockResolvedValue({ success: true, record: { country: 'GB' } });

		await update({ contactId: 'contact-uk' });

		expect(moduleRef.get).toHaveBeenCalled();
	});

	it.each([
		['not stored (TypeORM: the relation does not cascade)', 'US', false],
		['stored', 'DE', true]
	])(
		'lifts employee restrictions for a contact the write carries only when it was saved: %s',
		async (_, savedCountry, lifted) => {
			const US = { regionCode: 'en', timeZone: 'America/New_York' };
			given({ ...US, contact: { country: 'US' } }, { ...US, contact: { country: savedCountry } });

			await update({ contact: { country: 'DE' } });

			expect(organizationService.create).toHaveBeenCalled();
			expect(moduleRef.get).toHaveBeenCalledTimes(lifted ? 1 : 0);
		}
	);

	it('counts the stored location too: moving out of the EEA/UK and restricting exit in one save is refused', async () => {
		given({ regionCode: 'en', timeZone: 'Europe/Berlin', contact: { country: 'US' } });

		await expect(update({ timeZone: 'America/New_York', ...RESTRICT })).rejects.toThrow(
			EEA_UK_AGENT_RESTRICTION_ERR_MSG
		);
	});
});
