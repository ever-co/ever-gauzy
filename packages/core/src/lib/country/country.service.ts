import { Injectable } from '@nestjs/common';
import { CrudService } from '../core/crud/crud.service';
import { Country } from './country.entity';
import { TypeOrmCountryRepository } from './repository/type-orm-country.repository';
import { MikroOrmCountryRepository } from './repository/mikro-orm-country.repository';

@Injectable()
export class CountryService extends CrudService<Country> {
	constructor(
		typeOrmCountryRepository: TypeOrmCountryRepository,
		mikroOrmCountryRepository: MikroOrmCountryRepository
	) {
		super(typeOrmCountryRepository, mikroOrmCountryRepository);
	}
}
