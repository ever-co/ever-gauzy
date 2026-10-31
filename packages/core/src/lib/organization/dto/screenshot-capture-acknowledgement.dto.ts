import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { IScreenshotCaptureAcknowledgement } from '@gauzy/contracts';

/**
 * The admin's acknowledgement for turning screen capture on (issue #9872). Required, with all three
 * statements `true`, when the organization is in the EEA or the UK. Request-only: the server records who
 * gave it and when, not the body.
 */
export class ScreenshotCaptureAcknowledgementDTO implements IScreenshotCaptureAcknowledgement {
	@ApiProperty({
		type: () => Boolean,
		description:
			"The organization has a lawful basis for capturing its workers' screens (GDPR Art. 6), assessed as necessary and proportionate."
	})
	@IsBoolean()
	readonly lawfulBasis: boolean;

	@ApiProperty({
		type: () => Boolean,
		description:
			'The workers concerned were told, before capture starts, what is captured, why and for how long (GDPR Art. 13).'
	})
	@IsBoolean()
	readonly employeeNotice: boolean;

	@ApiProperty({
		type: () => Boolean,
		description: 'Any works council or employee-representative process this requires is complete, or none applies.'
	})
	@IsBoolean()
	readonly worksCouncil: boolean;
}
