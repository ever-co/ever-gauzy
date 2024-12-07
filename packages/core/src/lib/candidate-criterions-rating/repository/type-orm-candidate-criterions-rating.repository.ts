import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateCriterionsRating } from '../candidate-criterion-rating.entity';

@Injectable()
export class TypeOrmCandidateCriterionsRatingRepository extends Repository<CandidateCriterionsRating> {
    constructor(@InjectRepository(CandidateCriterionsRating) readonly repository: Repository<CandidateCriterionsRating>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
