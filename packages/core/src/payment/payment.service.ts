import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Like, In, Repository, Brackets, WhereExpressionBuilder } from 'typeorm';
import { chain } from 'underscore';
import * as moment from 'moment';
import { IGetPaymentInput } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Payment } from './payment.entity';
import { getDateFormat, getDaysBetweenDates,  } from '../core/utils';
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

	async getPayments(request: IGetPaymentInput) {
		const query = this.filterQuery(request);
		query.leftJoinAndSelect(`${query.alias}.project`, 'project');
		query.orderBy(`"${query.alias}"."paymentDate"`, 'ASC');
		return await query.getMany();
	}

	async getDailyReportChartData(request: IGetPaymentInput) {
		const query = this.filterQuery(request);
		query.orderBy(`"${query.alias}"."paymentDate"`, 'ASC');
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

	private filterQuery(request: IGetPaymentInput) {
		const { organizationId, startDate, endDate } = request;
		let { projectIds = [], contactIds = [] } = request;
		const tenantId = RequestContext.currentTenantId();

		const { start, end } = (startDate && endDate) ?
								getDateFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateFormat(
									moment().startOf('week').utc(),
									moment().endOf('week').utc()
								);

		const query = this.paymentRepository.createQueryBuilder();
		if (request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => { 
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
			})
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
			if ('paymentDate' in where) {
				const { paymentDate } = where;
				const { startDate, endDate } = paymentDate;

				if (startDate && endDate) {
					filter.where.paymentDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
					);
				} else {
					filter.where.paymentDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
			if ('tags' in where) {
				const { tags } = where; 
				filter.where.tags = {
					id: In(tags)
				}
			}
			if ('note' in where) {
				const { note } = where;
				filter.where.note = Like(`%${note}%`);
			}
		}
		return super.paginate(filter);
	}
}
