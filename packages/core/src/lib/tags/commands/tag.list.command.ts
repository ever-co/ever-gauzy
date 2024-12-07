import { ICommand } from '@nestjs/cqrs';
import { FindOptionsRelations, FindOptionsWhere } from 'typeorm';
import { Tag } from './../tag.entity';

export class TagListCommand implements ICommand {
	static readonly type = '[Tag] List';

	constructor(
		public readonly input: FindOptionsWhere<Tag>,
		public readonly relations: string[] | FindOptionsRelations<Tag>,
	) { }
}
