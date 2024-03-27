import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { CandidateTechnologies } from '../candidate-technologies.entity';

export class MikroOrmCandidateTechnologiesRepository extends MikroOrmBaseEntityRepository<CandidateTechnologies> { }
