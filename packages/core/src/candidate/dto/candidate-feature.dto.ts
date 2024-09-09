import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, ValidateIf } from 'class-validator';
import { ICandidate, ID, IRelationalCandidate } from '@gauzy/contracts';

export class CandidateFeatureDTO implements IRelationalCandidate {
	@ApiProperty({ type: () => String, readOnly: true })
	@ValidateIf((it) => !it.candidate || it.candidateId)
	@IsString()
	readonly candidateId: ID;

	@ApiProperty({ type: () => Object, readOnly: true })
	@ValidateIf((it) => !it.candidateId || it.candidate)
	@IsObject()
	readonly candidate: ICandidate;
}
