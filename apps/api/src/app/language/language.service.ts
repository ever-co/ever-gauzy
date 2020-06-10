import { Repository } from 'typeorm';
import { Language } from './language.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class LanguageService extends CrudService<Language> {
	constructor(
		@InjectRepository(Language)
		private readonly tagRepository: Repository<Language>
	) {
		super(tagRepository);
	}

	async findOneByName(name: string): Promise<Language> {
		const query = await this.repository
			.createQueryBuilder('tag')
			.where('"tag"."name" = :name', {
				name
			});
		const item = await query.getOne();
		return item;
	}
}
