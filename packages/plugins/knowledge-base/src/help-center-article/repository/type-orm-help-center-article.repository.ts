import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpCenterArticle } from '../help-center-article.entity';

@Injectable()
export class TypeOrmHelpCenterArticleRepository extends Repository<HelpCenterArticle> {
	constructor(@InjectRepository(HelpCenterArticle) readonly repository: Repository<HelpCenterArticle>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
