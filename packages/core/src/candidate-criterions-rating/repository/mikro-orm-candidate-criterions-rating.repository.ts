import { EntityRepository } from '@mikro-orm/knex';
import { CandidateCriterionsRating } from '../candidate-criterion-rating.entity';

export class MikroOrmCandidateCriterionsRatingRepository extends EntityRepository<CandidateCriterionsRating> { }
