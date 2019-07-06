import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Income } from '@gauzy/models';
import { IncomeCreateCommand } from '../income.create.command';
import { IncomeService } from '../../income.service';

@CommandHandler(IncomeCreateCommand)
export class IncomeCreateHandler implements ICommandHandler<IncomeCreateCommand> {
    constructor(
        private readonly incomeService: IncomeService,
    ) { }

    public async execute(command: IncomeCreateCommand): Promise<Income> {
        const { input } = command;
        console.log('command \r\n' + command.input)

        return await this.incomeService.create(input);
    }
}