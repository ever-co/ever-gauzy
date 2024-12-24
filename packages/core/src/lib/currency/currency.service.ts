import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud/crud.service';
import { TypeOrmCurrencyRepository } from './repository/type-orm-currency.repository';
import { MikroOrmCurrencyRepository } from './repository/mikro-orm-currency.repository';
import { Currency } from './currency.entity';

@Injectable()
export class CurrencyService extends CrudService<Currency> {
	constructor(
		@InjectRepository(Currency)
		typeOrmCurrencyRepository: TypeOrmCurrencyRepository,

		mikroOrmCurrencyRepository: MikroOrmCurrencyRepository
	) {
		super(typeOrmCurrencyRepository, mikroOrmCurrencyRepository);
	}
}
