import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository, Brackets, WhereExpressionBuilder, Raw, SelectQueryBuilder } from 'typeorm';
import { chain } from 'underscore';
import * as moment from 'moment';
import { IDateRangePicker, IGetPaymentInput } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Payment } from './payment.entity';
import { getDateRangeFormat, getDaysBetweenDates,  } from '../core/utils';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentService extends TenantAwareCrudService<Payment> {
	constructor(
		@InjectRepository(Payment)
		private readonly paymentRepository: Repository<Payment>,

		private readonly emailService: EmailService
	) {
		super(paymentRepository);
	}

	/**
	 * Get payments
	 *
	 * @param request
	 * @returns
	 */
	async getPayments(request: IGetPaymentInput) {
		const query = this.paymentRepository.createQueryBuilder(this.alias);
		query.setFindOptions({
			...(
				(request && request.limit > 0) ? {
					take: request.limit,
					skip: (request.page || 0) * request.limit
				} : {}
			),
			join: {
				alias: `${this.alias}`,
				leftJoin: {
					project: `${this.alias}.project`
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
		query.where((qb: SelectQueryBuilder<Payment>) => {
			this.getFilterQuery(qb, request);
		});
		return await query.getMany();
	}

	async getDailyReportChartData(request: IGetPaymentInput) {
		const query = this.paymentRepository.createQueryBuilder(this.alias);
		query.setFindOptions({
			...(
				(request.limit > 0) ? {
					take: request.limit,
					skip: (request.page || 0) * request.limit
				} : {}
			),
			order: {
				paymentDate: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<Payment>) => {
			this.getFilterQuery(qb, request);
		});
		const payments = await query.getMany();

		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const byDate = chain(payments)
			.groupBy((payment) =>
				moment(payment.paymentDate).format('YYYY-MM-DD')
			)
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
		const dates = days.map((date) => {
			if (byDate[date]) {
				return byDate[date];
			} else {
				return {
					date: date,
					value: {
						payment: 0
					}
				};
			}
		});
		return dates;
	}

	/**
	 *
	 * @param query
	 * @param request
	 * @returns
	 */
	private getFilterQuery(
		query: SelectQueryBuilder<Payment>,
		request: IGetPaymentInput
	) {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, startDate, endDate } = request;
		let { projectIds = [], contactIds = [] } = request;

		const { start, end } = (startDate && endDate) ?
								getDateRangeFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateRangeFormat(
									moment().startOf('week').utc(),
									moment().endOf('week').utc()
								);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where(						{
					paymentDate: Between(start, end)
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(projectIds)) {
					qb.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
						projectIds
					});
				}
				if (isNotEmpty(contactIds)) {
					qb.andWhere(`"${query.alias}"."organizationContactId" IN (:...contactIds)`, {
						contactIds
					});
				}
			})
		);
		return query;
	}

	async sendReceipt(languageCode, params, origin) {
		const payment = params.payment;
		const invoice = params.invoice;
		await this.emailService.sendPaymentReceipt(
			languageCode,
			invoice.toContact.primaryEmail,
			invoice.toContact.name,
			invoice.invoiceNumber,
			payment.amount,
			payment.currency,
			invoice.fromOrganization,
			origin
		);
	}

	public pagination(filter: any) {
		if ('where' in filter) {
			const { where } = filter;
			if ('note' in where) {
				const { note } = where;
				filter['where']['note'] = Raw((alias) => `${alias} ILIKE '%${note}%'`);
			}
			if ('paymentDate' in where) {
				const { paymentDate } = where;
				const { startDate, endDate } = paymentDate as IDateRangePicker;
				if (startDate && endDate) {
					filter['where']['paymentDate'] = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
					);
				} else {
					filter['where']['paymentDate'] = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
			if ('tags' in where) {
				const { tags } = where;
				filter['where']['tags'] = {
					id: In(tags)
				}
			}
		}
		return super.paginate(filter);
	}
}
