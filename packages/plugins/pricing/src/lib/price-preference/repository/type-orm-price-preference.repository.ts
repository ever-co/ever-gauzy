import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricePreference } from '../price-preference.entity';

@Injectable()
export class TypeOrmPricePreferenceRepository extends Repository<PricePreference> {
	constructor(@InjectRepository(PricePreference) readonly repository: Repository<PricePreference>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
