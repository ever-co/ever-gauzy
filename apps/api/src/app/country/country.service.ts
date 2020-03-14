import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Country } from './country.entity';
import * as fs from 'fs';
import * as csv from 'csv-writer';

@Injectable()
export class CountryService extends CrudService<Country> {
	constructor(
		@InjectRepository(Country)
		private readonly countryRepository: Repository<Country>
	) {
		super(countryRepository);
	}
}
