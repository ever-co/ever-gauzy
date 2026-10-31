import { ID } from './base-entity.model';
import { IAgentRestrictionLocation, isEEAOrUKLocation } from './eea-uk-region.util';

/**
 * Issue #9872 — screen capture is off on a new organization, and turning it on for an organization in the
 * EEA or the UK takes the admin's explicit acknowledgement, which is recorded (who, when, which tenant).
 *
 * In several member states an employer cannot lawfully capture their workers' screens without a step only
 * they can take: a lawful basis assessed as necessary and proportionate, prior notice to the workers, and
 * — in Germany, Austria and elsewhere — a works agreement or the works council's consent. The platform
 * cannot take those steps; it can make sure capture does not start before the admin says they were taken.
 *
 * The rules here are shared by the API (which enforces them) and the web app (which asks before saving).
 * Existing organizations keep their stored value: only a change that turns capture ON is concerned.
 */

/** A new organization does not capture screens until an admin turns it on. */
export const DEFAULT_ALLOW_SCREENSHOT_CAPTURE_ON_NEW_ORGANIZATION = false;

/**
 * The statements an admin confirms before screen capture is turned on for an EEA/UK organization:
 *
 * - `lawfulBasis` — the organization has a lawful basis for capturing its workers' screens (GDPR Art. 6),
 *   assessed as necessary and proportionate;
 * - `employeeNotice` — the workers concerned were told, before capture starts, what is captured, why and
 *   for how long (GDPR Art. 13);
 * - `worksCouncil` — any works council or employee-representative process it requires (for example
 *   §87(1) no. 6 BetrVG, §96(1) no. 3 ArbVG) is complete, or none applies.
 */
export const SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS = ['lawfulBasis', 'employeeNotice', 'worksCouncil'] as const;

export type ScreenshotCaptureAcknowledgementStatement = (typeof SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS)[number];

/** The admin's answer to each statement. Only `true` for all three is an acknowledgement. */
export type IScreenshotCaptureAcknowledgement = Record<ScreenshotCaptureAcknowledgementStatement, boolean>;

/** The screen capture members of an organization create or update request. */
export interface IScreenshotCaptureSettingInput {
	allowScreenshotCapture?: boolean;
	/**
	 * The admin's acknowledgement for this change. Request-only: it is never stored as sent; the server
	 * records who gave it and when (see {@link IScreenshotCaptureAcknowledgementRecord}).
	 */
	screenshotCaptureAcknowledgement?: Partial<IScreenshotCaptureAcknowledgement> | null;
}

/**
 * The record of the last acknowledgement on an organization, written by the server in the same write that
 * turns capture on. The tenant is the organization's own.
 */
export interface IScreenshotCaptureAcknowledgementRecord {
	/** When screen capture was last turned on with an acknowledgement. */
	screenshotCaptureAcknowledgedAt?: Date | null;
	/** The user who gave it. Set to null if that user is deleted; the activity log keeps the ID. */
	screenshotCaptureAcknowledgedByUserId?: ID | null;
}

export const SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED_ERR_MSG =
	'Turning on screen capture for an organization in the EEA or the UK requires an explicit acknowledgement (screenshotCaptureAcknowledgement with lawfulBasis, employeeNotice and worksCouncil all true), which is recorded against your account.';

/**
 * Whether a NEW organization captures screens: only when the request asks for it with a boolean; otherwise
 * {@link DEFAULT_ALLOW_SCREENSHOT_CAPTURE_ON_NEW_ORGANIZATION}.
 */
export function newOrganizationAllowsScreenshotCapture(input?: IScreenshotCaptureSettingInput | null): boolean {
	const requested = input?.allowScreenshotCapture;
	return typeof requested === 'boolean' ? requested : DEFAULT_ALLOW_SCREENSHOT_CAPTURE_ON_NEW_ORGANIZATION;
}

/**
 * Whether this change turns screen capture ON: the request sets it to `true` and the stored value (none, for
 * an organization being created) is not already `true`. Re-saving an organization that already captures is
 * not a change, and turning capture off never is.
 */
export function isScreenshotCaptureBeingEnabled(
	input?: Pick<IScreenshotCaptureSettingInput, 'allowScreenshotCapture'> | null,
	persisted?: Pick<IScreenshotCaptureSettingInput, 'allowScreenshotCapture'> | null
): boolean {
	return input?.allowScreenshotCapture === true && persisted?.allowScreenshotCapture !== true;
}

/** The statements an acknowledgement does not confirm (all three when there is none). */
export function missingScreenshotCaptureAcknowledgements(
	acknowledgement?: Partial<IScreenshotCaptureAcknowledgement> | null
): ScreenshotCaptureAcknowledgementStatement[] {
	return SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS.filter((statement) => acknowledgement?.[statement] !== true);
}

/**
 * Whether this change needs the acknowledgement: it turns capture on, for an organization that is in the
 * EEA/UK after the change.
 *
 * @param input the incoming create or update
 * @param persisted the organization as stored (none when it is being created)
 * @param location where the organization is after this change
 */
export function requiresScreenshotCaptureAcknowledgement(
	input: Pick<IScreenshotCaptureSettingInput, 'allowScreenshotCapture'> | null | undefined,
	persisted: Pick<IScreenshotCaptureSettingInput, 'allowScreenshotCapture'> | null | undefined,
	location: IAgentRestrictionLocation | IAgentRestrictionLocation[]
): boolean {
	return isScreenshotCaptureBeingEnabled(input, persisted) && isEEAOrUKLocation(location);
}

export interface IScreenshotCaptureChangeCheck {
	/** The statements still to confirm. Non-empty only when the change must be refused. */
	missing: ScreenshotCaptureAcknowledgementStatement[];
	/** The change turns capture on with a complete acknowledgement, which the caller records. */
	acknowledged: boolean;
}

/**
 * Server-side rule for issue #9872, applied to every organization create and update.
 *
 * - A change that does not turn capture on passes, and records nothing.
 * - Turning it on with all three statements confirmed passes, and the caller records who and when.
 * - Turning it on without them is refused for an EEA/UK organization, and passes (unrecorded) elsewhere.
 *
 * @param input the incoming create or update
 * @param persisted the organization as stored (none when it is being created)
 * @param location where the organization is after this change
 */
export function checkScreenshotCaptureChange(
	input: IScreenshotCaptureSettingInput | null | undefined,
	persisted: Pick<IScreenshotCaptureSettingInput, 'allowScreenshotCapture'> | null | undefined,
	location: IAgentRestrictionLocation | IAgentRestrictionLocation[]
): IScreenshotCaptureChangeCheck {
	if (!isScreenshotCaptureBeingEnabled(input, persisted)) {
		return { missing: [], acknowledged: false };
	}

	const missing = missingScreenshotCaptureAcknowledgements(input?.screenshotCaptureAcknowledgement);
	if (missing.length === 0) {
		return { missing: [], acknowledged: true };
	}

	return { missing: isEEAOrUKLocation(location) ? missing : [], acknowledged: false };
}
