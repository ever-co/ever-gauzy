import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * What the dock records when the carrier accepts the parcels.
 *
 * The scan count and the reconciliation list are the two facts a later claim is argued with: a parcel
 * the carrier scanned that is not on the manifest is reported here rather than appended to the
 * membership after the fact.
 */
export class HandOverCarrierManifestDTO {
	@ApiPropertyOptional({ type: () => Number, minimum: 0, description: 'How many parcels the carrier scanned.' })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly scanCount?: number;

	@ApiPropertyOptional({
		type: () => [String],
		description: 'Tracking numbers the carrier scanned that the manifest does not carry.'
	})
	@IsOptional()
	readonly scannedTrackingNumbers?: string[];

	@ApiPropertyOptional({ type: () => String, description: 'An operator note kept beside the hand-over.' })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** Why a manifest was withdrawn before hand-over. */
export class CancelCarrierManifestDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Why the manifest was cancelled.' })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}
