import {
	Injectable,
	NotFoundException,
	BadRequestException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { EmployeeService } from '../employee';
import { UserService } from '../user';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import { IntegrationType } from './integration.enum';
import { IncomeCreateCommand } from '../income/commands/income.create.command';
import { ExpenseCreateCommand } from '../expense/commands/expense.create.command';

// HARD CODED VALUES FOR CLIENT AND VENDOR
const commandBusMapper = {
	[IntegrationType.HOURLY]: {
		command: (payload) =>
			new IncomeCreateCommand({
				...payload,
				clientName: 'Upwork',
				clientId: '850'
			})
	},
	[IntegrationType.SERVICE_FEE]: {
		command: (payload) =>
			new ExpenseCreateCommand({
				...payload,
				vendorId: '850',
				vendorName: 'Upwork',
				categoryId: '700',
				categoryName: IntegrationType.SERVICE_FEE
			})
	}
};

@Injectable()
export class IntegrationsService {
	constructor(
		private _userService: UserService,
		private _employeeService: EmployeeService,
		private commandBus: CommandBus
	) {}

	async handleTransactions(filePath, { orgId }) {
		let results = [];

		const csvReader = fs
			.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => (results = results.concat(data)));

		return new Promise((resolve, reject) => {
			csvReader.on('end', async () => {
				results.forEach(async (result) => {
					if (
						result.Type === IntegrationType.HOURLY ||
						result.Type === IntegrationType.SERVICE_FEE
					) {
						const {
							Date: date,
							Amount,
							Freelancer,
							currency
						} = result;
						const [firstName, lastName] = Freelancer.split(' ');
						try {
							const user = await this._userService.findOneOrFail({
								where: {
									firstName,
									lastName
								}
							});

							const employee = await this._employeeService.findOne(
								{ where: { user } }
							);

							const dto = {
								amount: Amount as number,
								reference: result['Ref ID'],
								valueDate: new Date(date),
								employeeId: employee.id,
								currency,
								orgId
							};

							const command = commandBusMapper[
								result.Type
							].command(dto);
							await this.commandBus.execute(command);

							resolve(true);
						} catch (error) {
							reject(
								new BadRequestException('Freelancer not found')
							);
						}
					}
				});
			});
		});
	}
}
