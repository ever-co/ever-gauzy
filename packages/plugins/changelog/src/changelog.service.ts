import { CrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Changelog } from './changelog.entity';

@Injectable()
export class ChangelogService extends CrudService<Changelog> {
	constructor(
		@InjectRepository(Changelog)
		protected readonly changelogRepository: Repository<Changelog>
	) {
		super(changelogRepository);
	}
}
