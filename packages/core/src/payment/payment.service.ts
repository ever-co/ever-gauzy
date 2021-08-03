import { getDateRangeFormat,  } from '../core';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, In, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Payment } from './payment.entity';
import { RequestContext } from '../core/context';
import { IGetPaymentInput } from '@gauzy/contracts';
import { chain } from 'underscore';
import * as moment from 'moment';
import { EmailService } from '../email';
import { getConfig } from '@gauzy/config';
const config = getConfig();

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
		query.orderBy(`"${query.alias}"."paymentDate"`, 'ASC');

		// if (
		// 	RequestContext.hasPermission(
		// 		PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		// 	)
		// ) {
		// 	query.leftJoinAndSelect(
		// 		`${query.alias}.employee`,
		// 		'activityEmployee'
		// 	);
		// 	query.leftJoinAndSelect(
		// 		`activityEmployee.user`,
		// 		'activityUser',
		// 		'"employee"."userId" = activityUser.id'
		// 	);
		// }

		query.leftJoinAndSelect(`${query.alias}.project`, 'project');
		const payments = await query.getMany();
		return payments;
	}

	async getDailyReportChartData(request: IGetPaymentInput) {
		const query = this.filterQuery(request);
		query.orderBy(`"${query.alias}"."paymentDate"`, 'ASC');

		let dayList = [];
		const range = {};
		let i = 0;
		const start = moment(request.startDate);
		while (start.isSameOrBefore(request.endDate) && i < 31) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, 'day');
			i++;
		}
		dayList = Object.keys(range);
		const payments = await query.getMany();

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

		const dates = dayList.map((date) => {
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
		// let employeeIds: string[];
		const query = this.paymentRepository.createQueryBuilder();
		if (request && request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}
		// if (
		// 	RequestContext.hasPermission(
		// 		PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		// 	)
		// ) {
		// 	if (request.employeeIds) {
		// 		employeeIds = request.employeeIds;
		// 	}
		// } else {
		// 	const user = RequestContext.currentUser();
		// 	employeeIds = [user.employeeId];
		// }

		// query.innerJoin(`${query.alias}.employee`, 'employee');
		query.where((qb) => {
			if (request.startDate && request.endDate) {
				let startDate: any = moment.utc(request.startDate);
				let endDate: any = moment.utc(request.endDate);

				if (config.dbConnectionOptions.type === 'sqlite') {
					startDate = startDate.format('YYYY-MM-DD HH:mm:ss');
					endDate = endDate.format('YYYY-MM-DD HH:mm:ss');
				} else {
					startDate = startDate.toDate();
					endDate = endDate.toDate();
				}

				qb.where({
					paymentDate: Between(startDate, endDate)
				});
			}
			// if (employeeIds) {
			// 	qb.andWhere(
			// 		`"${query.alias}"."employeeId" IN (:...employeeId)`,
			// 		{
			// 			employeeId: employeeIds
			// 		}
			// 	);
			// }

			if (request.projectIds) {
				qb.andWhere(`"${query.alias}"."projectId" IN (:...projectId)`, {
					projectId: request.projectIds
				});
			}

			if (request.organizationId) {
				qb.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{
						organizationId: request.organizationId
					}
				);
			}

			qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId: RequestContext.currentTenantId()
			});
		});

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
		if ('filters' in filter) {
			const { filters } = filter;
			if ('note' in filters) {
				const { search } = filters.note;
				filter.where.note = ILike(`%${search}%`);
			}
			delete filter['filters'];
		}

		if ('where' in filter) {
			const { where } = filter;
			if ('paymentDate' in where) {
				const { paymentDate } = where;
				const { start, end } = getDateRangeFormat(
					new Date(moment(paymentDate).startOf('month').format()),
					new Date(moment(paymentDate).endOf('month').format()),
					true
				);
				filter.where.paymentDate = Between(start, end); 
			}
			if ('tags' in where) {
				const { tags } = where; 
				filter.where.tags = {
					id: In(tags)
				}
			}
		}
		return super.paginate(filter);
	}
}
