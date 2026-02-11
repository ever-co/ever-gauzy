import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpCenterArticleVersion } from '../help-center-article-version.entity';

@Injectable()
export class TypeOrmHelpCenterArticleVersionRepository extends Repository<HelpCenterArticleVersion> {
	constructor(@InjectRepository(HelpCenterArticleVersion) readonly repository: Repository<HelpCenterArticleVersion>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
