import { Injectable } from '@nestjs/common';
import { Between, In, Brackets, WhereExpressionBuilder, Raw, SelectQueryBuilder } from 'typeorm';
import { chain } from 'underscore';
import * as moment from 'moment';
import {
	ID,
	IDateRangePicker,
	IGetPaymentInput,
	IInvoice,
	IPagination,
	IPayment,
	LanguagesEnum,
	PaymentStats
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { Payment } from './payment.entity';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { LIKE_OPERATOR } from '../core/util';
import { getDateRangeFormat, getDaysBetweenDates } from '../core/utils';
import { EmailService } from './../email-send/email.service';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmPaymentRepository } from './repository/mikro-orm-payment.repository';
import { TypeOrmPaymentRepository } from './repository/type-orm-payment.repository';

@Injectable()
export class PaymentService extends TenantAwareCrudService<Payment> {
	constructor(
		readonly typeOrmPaymentRepository: TypeOrmPaymentRepository,
		readonly mikroOrmPaymentRepository: MikroOrmPaymentRepository,
		private readonly emailService: EmailService
	) {
		super(typeOrmPaymentRepository, mikroOrmPaymentRepository);
	}

	/**
	 * Retrieves the count and total amount of payments where `isProcessed` is true.
	 *
	 * @returns {Promise<PaymentStats>} An object containing the count of payments and the total amount.
	 */
	async getPaymentStats(): Promise<PaymentStats> {
		const result = await this.typeOrmPaymentRepository
			.createQueryBuilder('payment')
			.select('COUNT(payment.id)', 'count')
			.addSelect('SUM(payment.amount)', 'amount')
			.getRawOne();

		return {
			count: parseInt(result.count, 10),
			amount: parseFloat(result.amount) || 0
		};
	}

	/**
	 * Retrieves payments based on the provided request parameters.
	 *
	 * @param request - Request parameters for filtering payments.
	 * @returns A Promise that resolves to an array of payments.
	 */
	async getPayments(request: IGetPaymentInput) {
		// Create a query builder for the Payment entity
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

		// Set up the find options for the query
		query.setFindOptions({
			...(request && request.limit > 0
				? {
						take: request.limit,
						skip: (request.page || 0) * request.limit
				  }
				: {}),
			join: {
				alias: `${this.tableName}`,
				leftJoin: {
					project: `${this.tableName}.project`
				}
			},
			select: {
				project: {
					id: true,
					name: true,
					imageUrl: true,
					membersCount: true
				},
				organizationContact: {
					id: true,
					name: true,
					imageUrl: true
				}
			},
			relations: {
				project: true,
				organizationContact: true
			},
			order: {
				paymentDate: 'ASC'
			}
		});

		// Set up the where clause using the provided filter function
		query.where((qb: SelectQueryBuilder<Payment>) => {
			this.getFilterQuery(qb, request);
		});

		// Set up the where clause using the provided filter function
		return await query.getMany();
	}

	/**
	 * Retrieves daily payment report charts based on the provided request parameters.
	 *
	 * @param request - Request parameters for filtering data.
	 * @returns A Promise that resolves to an array of daily payment report charts.
	 */
	async getDailyReportCharts(request: IGetPaymentInput) {
		// Create a query builder for the Payment entity
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

		// Set up the find options for the query
		query.setFindOptions({
			...(request.limit > 0
				? {
						take: request.limit,
						skip: (request.page || 0) * request.limit
				  }
				: {}),
			order: {
				// Order results by the 'startedAt' field in ascending order
				paymentDate: 'ASC'
			}
		});

		// Set up the where clause using the provided filter function
		query.where((qb: SelectQueryBuilder<Payment>) => {
			this.getFilterQuery(qb, request);
		});

		// Set up the where clause using the provided filter function
		const payments = await query.getMany();

		// Gets an array of days between the given start date, end date and timezone.
		const { startDate, endDate, timeZone } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate, timeZone);

		// Group payments by date and calculate sum
		const byDate = chain(payments)
			.groupBy((payment: IPayment) => moment.utc(payment.paymentDate).tz(timeZone).format('YYYY-MM-DD'))
			.mapObject((payments: Payment[], date) => {
				const sum = payments.reduce((iteratee: any, payment: any) => {
					return iteratee + parseFloat(payment.amount);
				}, 0);
				return {
					date,
					value: {
						payment: sum.toFixed(1)
					}
				};
			})
			.value();
		// Map dates to the required format
		const dates = days.map((date) => byDate[date] || { date, value: { payment: 0 } });
		return dates;
	}

	/**
	 *
	 * @param query
	 * @param request
	 * @returns
	 */
	private getFilterQuery(query: SelectQueryBuilder<Payment>, request: IGetPaymentInput) {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, startDate, endDate } = request;
		let { projectIds = [], contactIds = [] } = request;

		// Calculate start and end dates using a utility function
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where({
					paymentDate: Between(start, end)
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(projectIds)) {
					qb.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), {
						projectIds
					});
				}
				if (isNotEmpty(contactIds)) {
					qb.andWhere(p(`"${query.alias}"."organizationContactId" IN (:...contactIds)`), {
						contactIds
					});
				}
			})
		);
		return query;
	}

	/**
	 *
	 * @param languageCode
	 * @param params
	 * @param origin
	 */
	async sendReceipt(
		languageCode: LanguagesEnum,
		invoice: IInvoice,
		payment: IPayment,
		origin: string
	): Promise<boolean> {
		try {
			const { primaryEmail: recipientEmail, name: recipientName } = invoice.toContact;

			await this.emailService.sendPaymentReceipt(
				languageCode,
				recipientEmail,
				recipientName,
				invoice.invoiceNumber,
				payment.amount,
				payment.currency,
				invoice.fromOrganization,
				origin
			);

			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Paginates PaymentEntity records using custom filters.
	 *
	 * @param filter - The pagination parameters including custom filters.
	 * @returns A promise resolving to paginated PaymentEntity data.
	 */
	public pagination(filter?: BaseQueryDTO<any>): Promise<IPagination<IPayment>> {
		if (filter?.where) {
			const { where } = filter;

			// Apply like filter for the note field.
			if (where.note) {
				filter.where['note'] = Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :note`, {
					note: `%${where.note}%`
				});
			}

			// Apply date range filter for paymentDate field
			if (where.paymentDate) {
				const { startDate, endDate } = where.paymentDate as IDateRangePicker;

				const start = startDate ? moment.utc(startDate) : moment().startOf('month').utc();
				const end = endDate ? moment.utc(endDate) : moment().endOf('month').utc();

				filter['where']['paymentDate'] = Between<string>(
					start.format('YYYY-MM-DD HH:mm:ss'),
					end.format('YYYY-MM-DD HH:mm:ss')
				);
			}

			// Apply filter for the tags field
			if (where.tags) {
				const { tags } = where;

				filter['where']['tags'] = {
					id: In(tags as Array<ID>)
				};
			}
		}

		return super.paginate(filter ?? {});
	}
}
