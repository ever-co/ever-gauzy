import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Country } from './country.entity';

@Injectable()
export class CountryService extends CrudService<Country> {
	constructor(
		@InjectRepository(Country)
		private readonly countryRepository: Repository<Country>,
		@MikroInjectRepository(Country)
		private readonly mikroCountryRepository: EntityRepository<Country>
	) {
		super(countryRepository, mikroCountryRepository);
	}
}
