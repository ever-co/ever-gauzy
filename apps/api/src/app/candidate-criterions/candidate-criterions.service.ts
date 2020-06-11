import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateCriterions } from './candidate-criterions.entity';

@Injectable()
export class CandidateCriterionsService extends CrudService<
	CandidateCriterions
> {
	constructor(
		@InjectRepository(CandidateCriterions)
		private readonly candidateCriterionsRepository: Repository<
			CandidateCriterions
		>
	) {
		super(candidateCriterionsRepository);
	}
}
