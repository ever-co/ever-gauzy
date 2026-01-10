import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginBilling } from '../entities/plugin-billing.entity';

export class TypeOrmPluginBillingRepository extends Repository<PluginBilling> {
	constructor(@InjectRepository(PluginBilling) readonly repository: Repository<PluginBilling>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
