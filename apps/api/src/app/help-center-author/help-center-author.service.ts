import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { HelpCenterAuthor } from './help-center-author.entity';

@Injectable()
export class HelpCenterAuthorService extends CrudService<HelpCenterAuthor> {
	constructor(
		@InjectRepository(HelpCenterAuthor)
		private readonly HelpCenterAuthorRepository: Repository<
			HelpCenterAuthor
		>
	) {
		super(HelpCenterAuthorRepository);
	}
}
