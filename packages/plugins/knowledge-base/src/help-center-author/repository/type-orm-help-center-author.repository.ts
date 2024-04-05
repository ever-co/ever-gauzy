import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpCenterAuthor } from '../help-center-author.entity';

@Injectable()
export class TypeOrmHelpCenterAuthorRepository extends Repository<HelpCenterAuthor> {
	constructor(@InjectRepository(HelpCenterAuthor) readonly repository: Repository<HelpCenterAuthor>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
