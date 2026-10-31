import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { IScreenshotCaptureAcknowledgement } from '@gauzy/contracts';

/**
 * The admin's acknowledgement for turning screen capture on (issue #9872). Required, with all three
 * statements `true`, when the organization is in the EEA or the UK. Request-only: the server records who
 * gave it and when, not the body.
 *
 * Each statement is optional here, so a partial acknowledgement reaches the rule and is refused with
 * `SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED` and the statements still `missing`, rather than with a generic
 * validation error. A statement that is sent must be a boolean.
 */
export class ScreenshotCaptureAcknowledgementDTO implements Partial<IScreenshotCaptureAcknowledgement> {
	@ApiPropertyOptional({
		type: () => Boolean,
		description:
			"The organization has a lawful basis for capturing its workers' screens (GDPR Art. 6), assessed as necessary and proportionate."
	})
	@IsOptional()
	@IsBoolean()
	readonly lawfulBasis?: boolean;

	@ApiPropertyOptional({
		type: () => Boolean,
		description:
			'The workers concerned were told, before capture starts, what is captured, why and for how long (GDPR Art. 13).'
	})
	@IsOptional()
	@IsBoolean()
	readonly employeeNotice?: boolean;

	@ApiPropertyOptional({
		type: () => Boolean,
		description: 'Any works council or employee-representative process this requires is complete, or none applies.'
	})
	@IsOptional()
	@IsBoolean()
	readonly worksCouncil?: boolean;
}
