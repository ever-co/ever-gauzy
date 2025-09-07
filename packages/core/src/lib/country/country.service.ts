import { Injectable } from '@nestjs/common';
import { CrudService } from '../core/crud/crud.service';
import { Country } from './country.entity';
import { TypeOrmCountryRepository } from './repository/type-orm-country.repository';
import { MikroOrmCountryRepository } from './repository/mikro-orm-country.repository';
import { MultiORMEnum } from '../core/utils';

@Injectable()
export class CountryService extends CrudService<Country> {
	constructor(
		typeOrmCountryRepository: TypeOrmCountryRepository,
		mikroOrmCountryRepository: MikroOrmCountryRepository
	) {
		super(typeOrmCountryRepository, mikroOrmCountryRepository);
	}

	/**
	 * Finds a country by its ISO code
	 *
	 * @param isoCode string
	 * @returns Promise<Country | null>
	 */
	async findByIsoCode(isoCode: string): Promise<Country | null> {
		if (!isoCode) return null;

		switch (this.ormType) {
			case MultiORMEnum.TypeORM:
				return this.typeOrmRepository.findOne({ where: { isoCode } });
			case MultiORMEnum.MikroORM:
				return this.mikroOrmRepository.findOne({ isoCode });
			default:
				return null;
		}
	}
}
