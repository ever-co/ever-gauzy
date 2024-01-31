import { Language } from './language.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MikroOrmLanguageRepository } from './repository/mikro-orm-language.repository';
import { TypeOrmLanguageRepository } from './repository/type-orm-language.repository';

@Injectable()
export class LanguageService extends CrudService<Language> {
	constructor(
		@InjectRepository(Language)
		typeOrmLanguageRepository: TypeOrmLanguageRepository,

		mikroOrmLanguageRepository: MikroOrmLanguageRepository
	) {
		super(typeOrmLanguageRepository, mikroOrmLanguageRepository);
	}

	/**
	 *
	 * @param name
	 * @returns
	 */
	async findOneByName(name: string): Promise<Language> {
		return await super.findOneByOptions({
			where: {
				name
			}
		});
	}
}
