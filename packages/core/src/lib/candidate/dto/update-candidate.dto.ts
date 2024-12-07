import { IntersectionType, PickType } from '@nestjs/swagger';
import { ICandidateUpdateInput } from '@gauzy/contracts';
import { UpdateProfileDTO } from './../../employee/dto';
import { Candidate } from '../candidate.entity';

export class UpdateCandidateDTO
	extends IntersectionType(
		UpdateProfileDTO,
		PickType(Candidate, ['appliedDate', 'hiredDate', 'cvUrl', 'candidateLevel'] as const)
	)
	implements ICandidateUpdateInput {}
