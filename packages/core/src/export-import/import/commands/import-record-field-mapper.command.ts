import { ICommand } from '@nestjs/cqrs';
import { Repository } from 'typeorm';


export class ImportRecordFieldMapperCommand implements ICommand {
	static readonly type = '[Import Record] Field Mapper';

	constructor(
		public readonly repository: Repository<any>,
		public readonly where: any,
	) {}
}