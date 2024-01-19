import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Repository } from 'typeorm';
import { Language } from './language.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { prepareSQLQuery as p } from '@gauzy/config';

@Injectable()
export class LanguageService extends CrudService<Language> {
	constructor(
		@InjectRepository(Language)
		private readonly tagRepository: Repository<Language>,
		@MikroInjectRepository(Language)
		private readonly mikroTagRepository: EntityRepository<Language>
	) {
		super(tagRepository, mikroTagRepository);
	}

	async findOneByName(name: string): Promise<Language> {
		const query = this.repository
			.createQueryBuilder('language')
			.where(p(`"language"."name" = :name`), {
				name
			});
		const item = await query.getOne();
		return item;
	}
}
