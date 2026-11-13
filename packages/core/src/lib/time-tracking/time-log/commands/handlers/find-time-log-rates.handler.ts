import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITimeLogStoredRates } from '@gauzy/contracts';
import { FindTimeLogRatesCommand } from '../find-time-log-rates.command';
import { findClientRates, findRatesToStore, TimeLogRatesToStore } from '../../time-log-rates';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';

@CommandHandler(FindTimeLogRatesCommand)
export class FindTimeLogRatesHandler implements ICommandHandler<FindTimeLogRatesCommand> {
	constructor(private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository) {}

	/**
	 * The rates of the moment, read through the TypeORM data source, which runs under both ORMs and writes every
	 * time log.
	 *
	 * @returns All the rates a log stores, or the client rates only.
	 */
	public async execute(command: FindTimeLogRatesCommand): Promise<TimeLogRatesToStore | ITimeLogStoredRates> {
		const manager = this.typeOrmTimeLogRepository.manager;
		if (command.part === 'client') {
			return await findClientRates(manager, command.scope);
		}
		return await findRatesToStore(manager, command.scope);
	}
}
