import { HttpStatus, Logger } from '@nestjs/common';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	checkScreenshotCaptureChange,
	IAgentRestrictionLocation,
	IOrganization,
	IScreenshotCaptureAcknowledgementRecord,
	IScreenshotCaptureSettingInput,
	SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED_ERR_MSG,
	SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import type { ActivityLogService } from '../activity-log/activity-log.service';

/**
 * Issue #9872 — screen capture is off on a new organization, and turning it on for an organization in the
 * EEA or the UK takes the admin's explicit acknowledgement, recorded against them. The rule itself is
 * `checkScreenshotCaptureChange` (`@gauzy/contracts`); this file applies it to the organization handlers.
 */

const logger = new Logger('ScreenshotCaptureAcknowledgement');

/**
 * Members of an organization write that a request may not set: the request-only acknowledgement, and the
 * record of it, which only the server writes (in the same write that turns capture on).
 */
export const SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_FIELDS = [
	'screenshotCaptureAcknowledgement',
	'screenshotCaptureAcknowledgedAt',
	'screenshotCaptureAcknowledgedByUserId',
	'screenshotCaptureAcknowledgedByUser'
] as const;

/**
 * A copy of an organization write without {@link SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_FIELDS}, so a body cannot
 * forge an acknowledgement record or have the request-only acknowledgement stored. Never mutates its argument.
 */
export function omitScreenshotCaptureAcknowledgementFields<T extends object>(input: T): T {
	const copy = { ...input };
	for (const field of SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_FIELDS) {
		delete (copy as Record<string, unknown>)[field];
	}
	return copy;
}

/**
 * Applies the rule to one organization create or update.
 *
 * @param input the incoming create or update, with `allowScreenshotCapture` as it will be stored
 * @param persisted the organization as stored (none when it is being created)
 * @param location where the organization is after this change
 * @returns the acknowledgement record to store in the same write, or `null` when this change records none
 * @throws ApiException 400 `SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED` when it turns capture on for an
 *   EEA/UK organization without all three statements; `details.missing` lists the ones left
 */
export function resolveScreenshotCaptureAcknowledgement(
	input: IScreenshotCaptureSettingInput,
	persisted: Pick<IScreenshotCaptureSettingInput, 'allowScreenshotCapture'> | null,
	location: IAgentRestrictionLocation | IAgentRestrictionLocation[]
): IScreenshotCaptureAcknowledgementRecord | null {
	const { missing, acknowledged } = checkScreenshotCaptureChange(input, persisted, location);

	if (missing.length > 0) {
		throw new ApiException(
			HttpStatus.BAD_REQUEST,
			ApiErrorCode.SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED,
			SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED_ERR_MSG,
			{ missing }
		);
	}

	if (!acknowledged) {
		return null;
	}

	return {
		screenshotCaptureAcknowledgedAt: new Date(),
		screenshotCaptureAcknowledgedByUserId: RequestContext.currentUserId() ?? null
	};
}

/**
 * Adds the acknowledgement to the organization's activity log: who, when, which tenant and organization,
 * and the statements confirmed. The record that cannot be lost is the one stored on the organization row in
 * the same write that turned capture on; this is its history, so a failure to write it is logged rather than
 * undoing a change that is already saved.
 */
export async function logScreenshotCaptureAcknowledgement(
	activityLogService: ActivityLogService,
	organization: Pick<IOrganization, 'id' | 'name' | 'tenantId'>,
	record: IScreenshotCaptureAcknowledgementRecord
): Promise<void> {
	const { id: organizationId, name, tenantId } = organization;
	const acknowledgedAt = new Date(record.screenshotCaptureAcknowledgedAt ?? Date.now()).toISOString();
	const acknowledgedByUserId = record.screenshotCaptureAcknowledgedByUserId ?? null;
	const statements = [...SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_STATEMENTS];

	try {
		await activityLogService.create({
			entity: BaseEntityEnum.Organization,
			entityId: organizationId,
			action: ActionTypeEnum.Updated,
			actorType: ActorTypeEnum.User,
			description: `${name}: screen capture turned on, acknowledged (${statements.join(', ')})`,
			updatedFields: ['allowScreenshotCapture'],
			data: { screenshotCaptureAcknowledgement: { acknowledgedByUserId, acknowledgedAt, tenantId, statements } },
			organizationId,
			tenantId
		});
	} catch (error) {
		logger.error(
			`Could not add the screen capture acknowledgement of organization ${organizationId} to the activity log: ${error?.message}`
		);
	}

	logger.log(
		`[SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT] User ${acknowledgedByUserId} turned on screen capture for organization ${organizationId} (tenant ${tenantId}) at ${acknowledgedAt}`
	);
}
