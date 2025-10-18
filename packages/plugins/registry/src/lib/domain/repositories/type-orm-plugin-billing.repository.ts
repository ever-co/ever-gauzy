import { Repository } from 'typeorm';
import { PluginBilling } from '../entities/plugin-billing.entity';

export class TypeOrmPluginBillingRepository extends Repository<PluginBilling> {}
