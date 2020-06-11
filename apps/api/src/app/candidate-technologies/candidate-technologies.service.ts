import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateTechnologies } from './candidate-technologies.entity';

@Injectable()
export class CandidateTechnologiesService extends CrudService<
	CandidateTechnologies
> {
	constructor(
		@InjectRepository(CandidateTechnologies)
		private readonly candidateTechnologiesRepository: Repository<
			CandidateTechnologies
		>
	) {
		super(candidateTechnologiesRepository);
	}
}
