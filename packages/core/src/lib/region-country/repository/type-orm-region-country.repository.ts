import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegionCountry } from '../region-country.entity';

@Injectable()
export class TypeOrmRegionCountryRepository extends Repository<RegionCountry> {
	constructor(@InjectRepository(RegionCountry) readonly repository: Repository<RegionCountry>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
