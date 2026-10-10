import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { TermsAcceptanceClaimDTO } from './terms-acceptance-claim.dto';

/**
 * The body of `POST /terms/accept`: the documents a signed-in person was shown and accepted.
 *
 * The person is not a member — the acceptance is always the caller's own — and every claim is re-checked
 * against the published corpus before anything is written, so these members are a claim, not evidence.
 * The cap keeps one request from asking the recorder to write an unbounded batch; the corpus publishes a
 * handful of documents per product.
 */
export class AcceptTermsDTO {
	@ApiProperty({ type: () => [TermsAcceptanceClaimDTO] })
	@IsArray()
	@ArrayNotEmpty({ message: 'Terms acceptance must list at least one document.' })
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => TermsAcceptanceClaimDTO)
	readonly terms: TermsAcceptanceClaimDTO[];
}
