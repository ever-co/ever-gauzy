import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from '../exchange-rate.entity';

@Injectable()
export class TypeOrmExchangeRateRepository extends Repository<ExchangeRate> {
	constructor(@InjectRepository(ExchangeRate) readonly repository: Repository<ExchangeRate>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
