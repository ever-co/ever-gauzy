import { Injectable, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as csv from 'csv-parser';
import { OrganizationVendorEnum, ExpenseCategoriesEnum, IncomeTypeEnum } from '@gauzy/contracts';
import {
	EmployeeService,
	Expense,
	ExpenseCategoriesService,
	ExpenseCreateCommand,
	Income,
	IncomeCreateCommand,
	OrganizationContactService,
	OrganizationVendorService,
	RequestContext,
	UserService,
	reflect
} from '@gauzy/core';

@Injectable()
export class UpworkTransactionService {
	private commandBusMapper = {
		[IncomeTypeEnum.HOURLY]: {
			command: ({ dto, client }) =>
				new IncomeCreateCommand({
					...dto,
					clientName: client.name,
					clientId: client.id
				})
		},
		[ExpenseCategoriesEnum.SERVICE_FEE]: {
			command: ({ dto, category, vendor }) =>
				new ExpenseCreateCommand({
					...dto,
					vendor,
					category
				})
		}
	};
	constructor(
		private readonly _userService: UserService,
		private readonly _employeeService: EmployeeService,
		private readonly _orgVendorService: OrganizationVendorService,
		private readonly _orgClientService: OrganizationContactService,
		private readonly _expenseCategoryService: ExpenseCategoriesService,
		private readonly _commandBus: CommandBus
	) {}

	async handleTransactions(file, { organizationId }) {
		const uuid = uuidv4();
		const dirPath = `./apps/api/src/app/integrations/upwork/csv/${uuid}`;
		const csvData = file.buffer.toString();
		const filePath = `${dirPath}/${file.originalname}`;
		let results = [];

		fs.mkdirSync(dirPath, { recursive: true });
		fs.writeFileSync(filePath, csvData);

		const csvReader = fs
			.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data) => (results = results.concat(data)));

		const tenantId = RequestContext.currentTenantId();

		return new Promise((resolve, reject) => {
			csvReader.on('end', async () => {
				fse.removeSync(dirPath);
				const transactions = results
					.filter(
						(result) =>
							result.Type === IncomeTypeEnum.HOURLY || result.Type === ExpenseCategoriesEnum.SERVICE_FEE
					)
					.map(async (result) => {
						const { Date: date, Amount, Freelancer, Currency, Team } = result;
						const [firstName, lastName] = Freelancer.split(' ');

						const { record: user } = await this._findRecordOrThrow(
							this._userService,
							{
								where: {
									firstName,
									lastName
								}
							},
							`User: ${Freelancer} not found`
						);

						const { record: employee } = await this._findRecordOrThrow(
							this._employeeService,
							{ where: { user, organizationId, tenantId } },
							`Employee ${Freelancer} not found`
						);

						const { record: category } = await this._findRecordOrThrow(
							this._expenseCategoryService,
							{
								where: {
									name: ExpenseCategoriesEnum.SERVICE_FEE,
									organizationId,
									tenantId
								}
							},
							`Category: ${ExpenseCategoriesEnum.SERVICE_FEE} not found`
						);

						const { record: vendor } = await this._findRecordOrThrow(
							this._orgVendorService,
							{
								where: {
									name: OrganizationVendorEnum.UPWORK,
									organizationId,
									tenantId
								}
							},
							`Vendor: ${OrganizationVendorEnum.UPWORK} not found`
						);

						const { record: client } = await this._findRecordOrThrow(
							this._orgClientService,
							{
								where: { name: Team, organizationId, tenantId }
							},
							`Client: ${Team} not found`
						);

						const dto = {
							amount: Amount as number,
							reference: result['Ref ID'],
							valueDate: new Date(date),
							employeeId: employee.id,
							currency: Currency,
							organizationId
						};

						const cmd = this.commandBusMapper[result.Type];

						return await this._commandBus.execute(
							cmd.command({
								dto,
								client,
								vendor,
								category
							})
						);
					});

				const processedTransactions = await Promise.all(transactions.map(reflect));
				const { rejectedTransactions, totalExpenses, totalIncomes } =
					this._proccessTransactions(processedTransactions);

				if (rejectedTransactions.length) {
					const errors = rejectedTransactions.map(({ error }) => error.response.message);
					const message = this._formatErrorMesage([...new Set(errors)], totalExpenses, totalIncomes);
					reject(new BadRequestException(message));
				}
				resolve({ totalExpenses, totalIncomes });
			});
		});
	}

	private _formatErrorMesage(errors, totalExpenses, totalIncomes): string {
		return `Total succeed expenses transactions: ${totalExpenses}.
			Total succeed incomes transactions: ${totalIncomes}.
			Failed transactions: ${errors.join(', ')}
		`;
	}

	private _proccessTransactions(processedTransactions) {
		const { rejectedTransactions, totalExpenses, totalIncomes } = processedTransactions.reduce(
			(prev, current) => {
				return {
					rejectedTransactions:
						current.status === 'rejected'
							? prev.rejectedTransactions.concat(current)
							: prev.rejectedTransactions,
					totalExpenses:
						current.item instanceof Expense
							? (prev.totalExpenses++, prev.totalExpenses)
							: prev.totalExpenses,
					totalIncomes:
						current.item instanceof Income ? (prev.totalIncomes++, prev.totalIncomes) : prev.totalIncomes
				};
			},
			{
				rejectedTransactions: [],
				totalExpenses: 0,
				totalIncomes: 0
			}
		);

		return {
			rejectedTransactions,
			totalExpenses,
			totalIncomes
		};
	}

	private async _findRecordOrThrow(service, condition, errorMsg) {
		const response = await service.findOneOrFailByOptions(condition);
		if (response.success) {
			return { record: response.record };
		}

		throw new BadRequestException(errorMsg);
	}
}
