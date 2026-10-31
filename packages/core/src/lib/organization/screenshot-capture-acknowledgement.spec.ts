import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import {
	logScreenshotCaptureAcknowledgement,
	omitScreenshotCaptureAcknowledgementFields,
	resolveScreenshotCaptureAcknowledgement,
	SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_FIELDS
} from './screenshot-capture-acknowledgement';

/**
 * Issue #9872 — the organization handlers' side of the screen capture acknowledgement: what a request may not
 * write, when a change is refused, the record a change stores, and its activity-log entry.
 */
const EEA = { regionCode: 'de', timeZone: 'Europe/Berlin' };
const UK = { country: 'GB' };
const ELSEWHERE = { regionCode: 'en', timeZone: 'America/New_York', country: 'US' };
const ALL = { lawfulBasis: true, employeeNotice: true, worksCouncil: true };
const ADMIN = 'f0000000-0000-4000-8000-0000000000b1';

afterEach(() => jest.restoreAllMocks());

describe('omitScreenshotCaptureAcknowledgementFields', () => {
	it('drops the request-only acknowledgement and every member of its record', () => {
		const input = {
			name: 'Acme',
			allowScreenshotCapture: true,
			screenshotCaptureAcknowledgement: ALL,
			screenshotCaptureAcknowledgedAt: new Date('2020-01-01'),
			screenshotCaptureAcknowledgedByUserId: 'someone-else',
			screenshotCaptureAcknowledgedByUser: { id: 'someone-else' }
		};

		expect(omitScreenshotCaptureAcknowledgementFields(input)).toEqual({
			name: 'Acme',
			allowScreenshotCapture: true
		});
	});

	it('never mutates its argument', () => {
		const input = { name: 'Acme', screenshotCaptureAcknowledgement: ALL };

		omitScreenshotCaptureAcknowledgementFields(input);

		expect(input).toEqual({ name: 'Acme', screenshotCaptureAcknowledgement: ALL });
	});

	it('covers the four names a body could carry', () => {
		expect([...SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_FIELDS].sort()).toEqual([
			'screenshotCaptureAcknowledgedAt',
			'screenshotCaptureAcknowledgedByUser',
			'screenshotCaptureAcknowledgedByUserId',
			'screenshotCaptureAcknowledgement'
		]);
	});
});

describe('resolveScreenshotCaptureAcknowledgement', () => {
	beforeEach(() => jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(ADMIN));

	const refusal = (fn: () => unknown): ApiException => {
		try {
			fn();
		} catch (error) {
			return error as ApiException;
		}
		throw new Error('expected a refusal');
	};

	it('refuses turning capture on for an EEA organization without the acknowledgement, naming what is missing', () => {
		const error = refusal(() =>
			resolveScreenshotCaptureAcknowledgement(
				{ allowScreenshotCapture: true },
				{ allowScreenshotCapture: false },
				EEA
			)
		);

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(400);
		expect(error.code).toBe(ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED);
		expect(error.details).toEqual({ missing: ['lawfulBasis', 'employeeNotice', 'worksCouncil'] });
	});

	it('refuses a partial acknowledgement for a UK organization, naming only what is left', () => {
		const error = refusal(() =>
			resolveScreenshotCaptureAcknowledgement(
				{
					allowScreenshotCapture: true,
					screenshotCaptureAcknowledgement: { lawfulBasis: true, employeeNotice: true, worksCouncil: false }
				},
				{ allowScreenshotCapture: false },
				UK
			)
		);

		expect(error.details).toEqual({ missing: ['worksCouncil'] });
	});

	it('returns the record of who acknowledged it and when, for the same write', () => {
		const before = Date.now();

		const record = resolveScreenshotCaptureAcknowledgement(
			{ allowScreenshotCapture: true, screenshotCaptureAcknowledgement: ALL },
			{ allowScreenshotCapture: false },
			EEA
		);

		expect(record?.screenshotCaptureAcknowledgedByUserId).toBe(ADMIN);
		expect(record?.screenshotCaptureAcknowledgedAt).toBeInstanceOf(Date);
		expect(record?.screenshotCaptureAcknowledgedAt?.getTime()).toBeGreaterThanOrEqual(before);
	});

	it('records no user when the request has none', () => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);

		const record = resolveScreenshotCaptureAcknowledgement(
			{ allowScreenshotCapture: true, screenshotCaptureAcknowledgement: ALL },
			null,
			EEA
		);

		expect(record?.screenshotCaptureAcknowledgedByUserId).toBeNull();
	});

	it.each([
		['keeps capture on', { allowScreenshotCapture: true }, { allowScreenshotCapture: true }],
		['turns capture off', { allowScreenshotCapture: false }, { allowScreenshotCapture: true }],
		['does not send the flag', {}, { allowScreenshotCapture: false }]
	])('asks nothing and records nothing when a change %s', (_, input, persisted) => {
		expect(resolveScreenshotCaptureAcknowledgement(input, persisted, EEA)).toBeNull();
	});

	it('asks nothing outside the EEA and the UK', () => {
		expect(
			resolveScreenshotCaptureAcknowledgement(
				{ allowScreenshotCapture: true },
				{ allowScreenshotCapture: false },
				ELSEWHERE
			)
		).toBeNull();
	});

	it('still records a complete acknowledgement given outside the EEA and the UK', () => {
		const record = resolveScreenshotCaptureAcknowledgement(
			{ allowScreenshotCapture: true, screenshotCaptureAcknowledgement: ALL },
			{ allowScreenshotCapture: false },
			ELSEWHERE
		);

		expect(record?.screenshotCaptureAcknowledgedByUserId).toBe(ADMIN);
	});
});

describe('logScreenshotCaptureAcknowledgement', () => {
	const organization = { id: 'org-1', name: 'Acme', tenantId: 'tenant-1' };
	const record = {
		screenshotCaptureAcknowledgedAt: new Date('2026-10-31T10:00:00.000Z'),
		screenshotCaptureAcknowledgedByUserId: ADMIN
	};

	it('adds who, when, which tenant and the statements to the organization activity log', async () => {
		const activityLogService = { create: jest.fn().mockResolvedValue({}) };

		await logScreenshotCaptureAcknowledgement(activityLogService as never, organization, record);

		expect(activityLogService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				entity: BaseEntityEnum.Organization,
				entityId: 'org-1',
				action: ActionTypeEnum.Updated,
				actorType: ActorTypeEnum.User,
				updatedFields: ['allowScreenshotCapture'],
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				data: {
					screenshotCaptureAcknowledgement: {
						acknowledgedByUserId: ADMIN,
						acknowledgedAt: '2026-10-31T10:00:00.000Z',
						tenantId: 'tenant-1',
						statements: ['lawfulBasis', 'employeeNotice', 'worksCouncil']
					}
				}
			})
		);
	});

	it('does not undo a saved change when the activity log cannot be written', async () => {
		const activityLogService = { create: jest.fn().mockRejectedValue(new Error('down')) };

		await expect(
			logScreenshotCaptureAcknowledgement(activityLogService as never, organization, record)
		).resolves.toBeUndefined();
	});
});
