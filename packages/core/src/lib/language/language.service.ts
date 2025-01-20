import { Injectable } from '@nestjs/common';
import { CrudService } from '../core/crud/crud.service';
import { TypeOrmLanguageRepository } from './repository/type-orm-language.repository';
import { MikroOrmLanguageRepository } from './repository/mikro-orm-language.repository';
import { Language } from './language.entity';

@Injectable()
export class LanguageService extends CrudService<Language> {
	constructor(
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
