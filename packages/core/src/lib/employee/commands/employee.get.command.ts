import { ICommand } from '@nestjs/cqrs';
import { FindOneOptions } from 'typeorm';
import { Employee } from './../employee.entity';

export class EmployeeGetCommand implements ICommand {
	static readonly type = '[Employee] Get';

	constructor(
		public readonly input: FindOneOptions<Employee>
	) {}
}
