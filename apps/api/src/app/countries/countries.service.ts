import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Countries } from './countries.entity';

@Injectable()
export class CountriesService extends CrudService<Countries> {
	constructor(
		@InjectRepository(Countries)
		private readonly countriesRepository: Repository<Countries>
	) {
		super(countriesRepository);
	}
}
