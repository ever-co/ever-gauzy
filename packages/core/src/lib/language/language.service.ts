import { Language } from './language.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MikroOrmLanguageRepository, TypeOrmLanguageRepository } from './repository';

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
	 * Finds a single Language entity by its name.
	 *
	 * @param name The name of the Language entity to be found.
	 * @returns A promise that resolves to the Language entity if found, or null if not found.
	 */
	findOneByName(name: string): Promise<Language> {
		return super.findOneByOptions({
			where: { name }
		});
	}
}
