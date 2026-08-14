import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ITermsAcceptanceClaim } from '@gauzy/contracts';

/**
 * One document a signup / invite-acceptance form says it displayed.
 *
 * These values arrive from a browser, so they are a *claim*, not evidence. The
 * shape checks here only stop obvious rubbish; what makes the claim true is
 * `TermsAcceptanceService`, which re-checks every field against the published
 * legal corpus before a row is written. A digest the corpus never published is
 * rejected outright — recording it would produce evidence pointing at nothing.
 */
export class TermsAcceptanceClaimDTO implements ITermsAcceptanceClaim {
	@ApiProperty({ type: () => String, example: 'tos:gauzy' })
	@IsNotEmpty({ message: 'Terms acceptance requires a document id.' })
	@IsString()
	@MaxLength(255)
	readonly documentId: string;

	@ApiProperty({ type: () => String, example: '1.0.0' })
	@IsNotEmpty({ message: 'Terms acceptance requires a document version.' })
	@IsString()
	@MaxLength(64)
	readonly version: string;

	@ApiProperty({ type: () => String, description: 'Lowercase hex sha256 of the document source.' })
	@IsNotEmpty({ message: 'Terms acceptance requires the sha256 of the text that was shown.' })
	@Matches(/^[0-9a-f]{64}$/, {
		message: 'sha256 must be a 64-character lowercase hex digest.'
	})
	readonly sha256: string;

	@ApiProperty({ type: () => String, example: 'en' })
	@IsNotEmpty({ message: 'Terms acceptance requires the locale of the text that was shown.' })
	@IsString()
	@MaxLength(35)
	readonly locale: string;
}
