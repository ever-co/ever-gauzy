import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeCreateCommand } from '../employee.create.command';
import { EmployeeService } from '../../employee.service';
import { Employee } from '@gauzy/models';

@CommandHandler(EmployeeCreateCommand)
export class EmployeeCreateHandler implements ICommandHandler<EmployeeCreateCommand> {
    constructor(
        private readonly employeeService: EmployeeService,
    ) { }

    public async execute(command: EmployeeCreateCommand): Promise<Employee> {
        const { input } = command;

        return await this.employeeService.create(input);
    }
}