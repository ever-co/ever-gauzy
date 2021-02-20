import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Changelog } from './changelog.entity';

@Injectable()
export class ChangelogService extends CrudService<Changelog> {
	constructor(
		@InjectRepository(Changelog)
		changelogRepository: Repository<Changelog>
	) {
		super(changelogRepository);
	}
}
