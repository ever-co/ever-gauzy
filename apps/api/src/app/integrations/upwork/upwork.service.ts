import { Injectable, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee';
import { UserService } from '../../user';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import { IncomeCreateCommand } from '../../income/commands/income.create.command';
import { ExpenseCreateCommand } from '../../expense/commands/expense.create.command';
import { OrganizationVendorsService } from '../../organization-vendors';
import { OrganizationClientsService } from '../../organization-clients';
import { ExpenseCategoriesService } from '../../expense-categories';
import {
	OrganizationVendorsEnum,
	ExpenseCategoriesEnum,
	IncomeTypeEnum
} from '@gauzy/models';
import { Expense } from '../../expense';
import { Income } from '../../income';
import { reflect } from '../../core';

@Injectable()
export class UpworkService {
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
					vendorId: vendor.id,
					vendorName: vendor.name,
					categoryId: category.id,
					categoryName: category.name
				})
		}
	};
	constructor(
		private _userService: UserService,
		private _employeeService: EmployeeService,
		private _orgVendorService: OrganizationVendorsService,
		private _orgClientService: OrganizationClientsService,
		private _expenseCategoryService: ExpenseCategoriesService,
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
				const transactions = await results
					.filter(
						(result) =>
							result.Type === IncomeTypeEnum.HOURLY ||
							result.Type === ExpenseCategoriesEnum.SERVICE_FEE
					)
					.map(async (result) => {
						const {
							Date: date,
							Amount,
							Freelancer,
							Currency,
							Team
						} = result;
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

						const {
							record: employee
						} = await this._findRecordOrThrow(
							this._employeeService,
							{ where: { user } },
							`Employee ${Freelancer} not found`
						);

						const {
							record: category
						} = await this._findRecordOrThrow(
							this._expenseCategoryService,
							{
								where: {
									name: ExpenseCategoriesEnum.SERVICE_FEE
								}
							},
							`Category: ${ExpenseCategoriesEnum.SERVICE_FEE} not found`
						);

						const {
							record: vendor
						} = await this._findRecordOrThrow(
							this._orgVendorService,
							{
								where: {
									name: OrganizationVendorsEnum.UPWORK,
									organizationId: orgId
								}
							},
							`Vendor: ${OrganizationVendorsEnum.UPWORK} not found`
						);

						const {
							record: client
						} = await this._findRecordOrThrow(
							this._orgClientService,
							{
								where: { name: Team, organizationId: orgId }
							},
							`Client: ${Team} not found`
						);

						const dto = {
							amount: Amount as number,
							reference: result['Ref ID'],
							valueDate: new Date(date),
							employeeId: employee.id,
							currency: Currency,
							orgId
						};

						const cmd = this.commandBusMapper[result.Type];

						return await this.commandBus.execute(
							cmd.command({
								dto,
								client,
								vendor,
								category
							})
						);
					});

				const processedTransactions = await Promise.all(
					transactions.map(reflect)
				);
				const {
					rejectedTransactions,
					totalExpenses,
					totalIncomes
				} = this._proccessTransactions(processedTransactions);

				if (rejectedTransactions.length) {
					const errors = rejectedTransactions.map(
						({ error }) => error.response.message
					);
					const message = this._formatErrorMesage(
						[...new Set(errors)],
						totalExpenses,
						totalIncomes
					);

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
		const {
			rejectedTransactions,
			totalExpenses,
			totalIncomes
		} = processedTransactions.reduce(
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
						current.item instanceof Income
							? (prev.totalIncomes++, prev.totalIncomes)
							: prev.totalIncomes
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
		const response = await service.findOneOrFail(condition);
		if (response.success) {
			return { record: response.record };
		}

		throw new BadRequestException(errorMsg);
	}
}
