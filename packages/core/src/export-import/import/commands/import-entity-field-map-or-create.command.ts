import { ICommand } from '@nestjs/cqrs';
import { Repository } from 'typeorm';

export class ImportEntityFieldMapOrCreateCommand implements ICommand {
	static readonly type = '[Import Entity] Map Or Create';

	constructor(
		public readonly repository: Repository<any>,
		public readonly where: any,
		public readonly entity: any
	) {}
}