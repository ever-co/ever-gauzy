import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { TaxLine } from '../tax-line.entity';

export class MikroOrmTaxLineRepository extends MikroOrmBaseEntityRepository<TaxLine> {}
