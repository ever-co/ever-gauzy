import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateCv } from './candidate-cv.entity';

@Injectable()
export class CandidateCvService extends CrudService<CandidateCv> {
	constructor(
		@InjectRepository(CandidateCv)
		private readonly candidateCvRepository: Repository<CandidateCv>
	) {
		super(candidateCvRepository);
	}
}
