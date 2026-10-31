import {
	checkScreenshotCaptureChange,
	DEFAULT_ALLOW_SCREENSHOT_CAPTURE_ON_NEW_ORGANIZATION,
	isScreenshotCaptureBeingEnabled,
	missingScreenshotCaptureAcknowledgements,
	newOrganizationAllowsScreenshotCapture,
	requiresScreenshotCaptureAcknowledgement,
	SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS
} from './screenshot-capture-acknowledgement.util';

const EEA = { regionCode: 'de-DE', timeZone: 'Europe/Berlin', country: 'Germany' };
const UK = { timeZone: 'Europe/London' };
const ELSEWHERE = { regionCode: 'en-US', timeZone: 'America/New_York', country: 'United States' };
const COMPLETE = { lawfulBasis: true, employeeNotice: true, worksCouncil: true };

describe('newOrganizationAllowsScreenshotCapture (issue #9872)', () => {
	it('starts a new organization with screen capture off', () => {
		expect(DEFAULT_ALLOW_SCREENSHOT_CAPTURE_ON_NEW_ORGANIZATION).toBe(false);
		expect(newOrganizationAllowsScreenshotCapture({})).toBe(false);
		expect(newOrganizationAllowsScreenshotCapture(undefined)).toBe(false);
		expect(newOrganizationAllowsScreenshotCapture(null)).toBe(false);
	});

	it('keeps an explicit boolean', () => {
		expect(newOrganizationAllowsScreenshotCapture({ allowScreenshotCapture: true })).toBe(true);
		expect(newOrganizationAllowsScreenshotCapture({ allowScreenshotCapture: false })).toBe(false);
	});

	it('does not read a value that is not a boolean as a request to capture', () => {
		expect(newOrganizationAllowsScreenshotCapture({ allowScreenshotCapture: null })).toBe(false);
		expect(newOrganizationAllowsScreenshotCapture({ allowScreenshotCapture: 'true' as unknown as boolean })).toBe(
			false
		);
	});
});

describe('isScreenshotCaptureBeingEnabled', () => {
	it('is a change from off (or nothing stored) to on', () => {
		expect(
			isScreenshotCaptureBeingEnabled({ allowScreenshotCapture: true }, { allowScreenshotCapture: false })
		).toBe(true);
		expect(isScreenshotCaptureBeingEnabled({ allowScreenshotCapture: true }, null)).toBe(true);
	});

	it('is not a re-save of an organization that already captures', () => {
		expect(
			isScreenshotCaptureBeingEnabled({ allowScreenshotCapture: true }, { allowScreenshotCapture: true })
		).toBe(false);
	});

	it('is not turning capture off, nor an update that does not mention it', () => {
		expect(
			isScreenshotCaptureBeingEnabled({ allowScreenshotCapture: false }, { allowScreenshotCapture: true })
		).toBe(false);
		expect(isScreenshotCaptureBeingEnabled({}, { allowScreenshotCapture: false })).toBe(false);
	});
});

describe('missingScreenshotCaptureAcknowledgements', () => {
	it('lists every statement when there is no acknowledgement', () => {
		expect(missingScreenshotCaptureAcknowledgements(undefined)).toEqual([
			...SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS
		]);
		expect(missingScreenshotCaptureAcknowledgements(null)).toEqual([
			'lawfulBasis',
			'employeeNotice',
			'worksCouncil'
		]);
	});

	it('lists the statements that are not strictly true', () => {
		expect(
			missingScreenshotCaptureAcknowledgements({
				lawfulBasis: true,
				employeeNotice: false,
				worksCouncil: 'yes' as unknown as boolean
			})
		).toEqual(['employeeNotice', 'worksCouncil']);
	});

	it('is empty for a complete acknowledgement', () => {
		expect(missingScreenshotCaptureAcknowledgements(COMPLETE)).toEqual([]);
	});
});

describe('requiresScreenshotCaptureAcknowledgement', () => {
	it('is required when capture is turned on for an EEA or UK organization', () => {
		expect(
			requiresScreenshotCaptureAcknowledgement(
				{ allowScreenshotCapture: true },
				{ allowScreenshotCapture: false },
				EEA
			)
		).toBe(true);
		expect(requiresScreenshotCaptureAcknowledgement({ allowScreenshotCapture: true }, null, UK)).toBe(true);
	});

	it('is not required elsewhere, nor when capture stays on or goes off', () => {
		expect(
			requiresScreenshotCaptureAcknowledgement(
				{ allowScreenshotCapture: true },
				{ allowScreenshotCapture: false },
				ELSEWHERE
			)
		).toBe(false);
		expect(
			requiresScreenshotCaptureAcknowledgement(
				{ allowScreenshotCapture: true },
				{ allowScreenshotCapture: true },
				EEA
			)
		).toBe(false);
		expect(
			requiresScreenshotCaptureAcknowledgement(
				{ allowScreenshotCapture: false },
				{ allowScreenshotCapture: true },
				EEA
			)
		).toBe(false);
	});
});

describe('checkScreenshotCaptureChange', () => {
	const off = { allowScreenshotCapture: false };

	it('passes and records nothing when the change does not turn capture on', () => {
		expect(checkScreenshotCaptureChange({ name: 'x' } as object, off, EEA)).toEqual({
			missing: [],
			acknowledged: false
		});
		expect(
			checkScreenshotCaptureChange({ allowScreenshotCapture: false }, { allowScreenshotCapture: true }, EEA)
		).toEqual({
			missing: [],
			acknowledged: false
		});
		expect(
			checkScreenshotCaptureChange({ allowScreenshotCapture: true }, { allowScreenshotCapture: true }, EEA)
		).toEqual({ missing: [], acknowledged: false });
	});

	it('refuses turning capture on for an EEA/UK organization without the acknowledgement', () => {
		expect(checkScreenshotCaptureChange({ allowScreenshotCapture: true }, off, EEA)).toEqual({
			missing: ['lawfulBasis', 'employeeNotice', 'worksCouncil'],
			acknowledged: false
		});
		expect(
			checkScreenshotCaptureChange(
				{
					allowScreenshotCapture: true,
					screenshotCaptureAcknowledgement: { lawfulBasis: true, employeeNotice: true }
				},
				off,
				UK
			)
		).toEqual({ missing: ['worksCouncil'], acknowledged: false });
	});

	it('passes turning capture on with all three statements, which the caller records', () => {
		expect(
			checkScreenshotCaptureChange(
				{ allowScreenshotCapture: true, screenshotCaptureAcknowledgement: COMPLETE },
				off,
				EEA
			)
		).toEqual({ missing: [], acknowledged: true });
	});

	it('does not ask outside the EEA/UK, and records an acknowledgement given there anyway', () => {
		expect(checkScreenshotCaptureChange({ allowScreenshotCapture: true }, off, ELSEWHERE)).toEqual({
			missing: [],
			acknowledged: false
		});
		expect(
			checkScreenshotCaptureChange(
				{ allowScreenshotCapture: true, screenshotCaptureAcknowledgement: COMPLETE },
				off,
				ELSEWHERE
			)
		).toEqual({ missing: [], acknowledged: true });
	});

	it('judges an organization by every location it has, so one cannot mask the other', () => {
		expect(
			checkScreenshotCaptureChange({ allowScreenshotCapture: true }, off, [ELSEWHERE, EEA]).missing
		).toHaveLength(3);
	});

	it('treats an organization being created as having nothing stored', () => {
		expect(checkScreenshotCaptureChange({ allowScreenshotCapture: true }, null, EEA).missing).toHaveLength(3);
		expect(checkScreenshotCaptureChange({}, null, EEA)).toEqual({ missing: [], acknowledged: false });
	});
});
