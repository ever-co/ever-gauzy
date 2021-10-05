import {
	IPayment,
	IPaymentReportGroupByClient,
	IPaymentReportGroupByDate,
	IPaymentReportGroupByProject
} from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { chain } from 'underscore';

@Injectable()
export class PaymentMapService {
	constructor() {}

	mapByDate(payments: IPayment[]): IPaymentReportGroupByDate[] {
		const dailyLogs: any = this.groupByDate(payments).map(
			(byDatePayment: IPayment[], date) => {
				const sum = this.getDurationSum(byDatePayment);
				const byClient = this.groupByClient(byDatePayment).map(
					(byClientPayment: IPayment[]) => {
						const byProject = this.groupByProject(
							byClientPayment
						).map((byProjectPayment: IPayment[]) => {
							const project =
								byProjectPayment.length > 0 &&
								byProjectPayment[0]
									? byProjectPayment[0].project
									: null;

							return {
								project,
								payments: byProjectPayment.map((row) =>
									this.mapPaymentPercentage(row, sum)
								)
							};
						});

						const employee =
							byClientPayment.length > 0 && byClientPayment[0]
								? byClientPayment[0].employee
								: null;
						return {
							employee,
							projects: byProject
						};
					}
				);

				return {
					date,
					clients: byClient
				};
			}
		);
		return dailyLogs;
	}

	mapByClient(payments: IPayment[]): IPaymentReportGroupByClient[] {
		const byClient: any = this.groupByClient(payments).map(
			(byClientPayment: IPayment[]) => {
				const sum = this.getDurationSum(byClientPayment);
				const dailyLogs = this.groupByDate(byClientPayment).map(
					(byDatePayment: IPayment[], date) => {
						const byProject = this.groupByProject(
							byDatePayment
						).map((byProjectPayment: IPayment[]) => {
							const project =
								byProjectPayment.length > 0 &&
								byProjectPayment[0]
									? byProjectPayment[0].project
									: null;
							return {
								project,
								payments: byProjectPayment.map((row) =>
									this.mapPaymentPercentage(row, sum)
								)
							};
						});

						return {
							date,
							projects: byProject
						};
					}
				);

				const client =
					byClientPayment.length > 0 && byClientPayment[0]
						? byClientPayment[0].organizationContact
						: null;
				return {
					client,
					dates: dailyLogs
				};
			}
		);
		return byClient;
	}

	mapByProject(payments: IPayment[]): IPaymentReportGroupByProject[] {
		const byClient: any = this.groupByProject(payments).map(
			(byProjectPayment: IPayment[]) => {
				const sum = this.getDurationSum(byProjectPayment);

				const dailyLogs = this.groupByDate(byProjectPayment).map(
					(byDatePayment: IPayment[], date) => {
						const byProject = this.groupByClient(byDatePayment).map(
							(byClientPayment: IPayment[]) => {
								const employee =
									byClientPayment.length > 0 &&
									byClientPayment[0]
										? byClientPayment[0].employee
										: null;
								return {
									employee,
									payments: byClientPayment.map((row) =>
										this.mapPaymentPercentage(row, sum)
									)
								};
							}
						);

						return {
							date,
							clients: byProject
						};
					}
				);

				const project =
					byProjectPayment.length > 0 && byProjectPayment[0]
						? byProjectPayment[0].project
						: null;
				return {
					project,
					dates: dailyLogs
				};
			}
		);
		return byClient;
	}

	private groupByProject(payments: IPayment[]) {
		return chain(payments).groupBy((payment) => {
			return payment.projectId;
		});
	}

	private groupByDate(payments: IPayment[]) {
		return chain(payments).groupBy((payment) => {
			return moment.utc(payment.paymentDate).format('YYYY-MM-DD');
		});
	}

	private groupByClient(payments: IPayment[]) {
		return chain(payments).groupBy((payment) => {
			return payment.employeeId;
		});
	}

	// private groupByClient(payments: IPayment[]) {
	// 	return chain(payments).groupBy((payment) => {
	// 		return payment.contactId;
	// 	});
	// }

	private mapPaymentPercentage(payments, sum = 0) {
		payments.duration_percentage =
			(parseInt(payments.duration, 10) * 100) / sum;
		return payments;
	}

	private getDurationSum(payments) {
		return payments.reduce((iteratee: any, log: any) => {
			return iteratee + parseInt(log.duration, 10);
		}, 0);
	}
}
