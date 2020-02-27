import { Repository } from 'typeorm';
import { Tag } from './tag.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TagService extends CrudService<Tag> {
	constructor(
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>
	) {
		super(tagRepository);
	}
}
