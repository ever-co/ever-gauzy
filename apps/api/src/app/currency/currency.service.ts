import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Currency } from './currency.entity';

@Injectable()
export class CurrencyService extends CrudService<Currency> {
	constructor(
		@InjectRepository(Currency)
		private readonly currencyRepository: Repository<Currency>
	) {
		super(currencyRepository);
	}
}
