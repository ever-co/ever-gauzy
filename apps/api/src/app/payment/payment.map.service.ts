import {
	IPayment,
	IPaymentReportGroupByDate,
	IPaymentReportGroupByEmployee,
	IPaymentReportGroupByProject
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { chain } from 'underscore';

@Injectable()
export class PaymentMapService {
	constructor() {}

	mapByDate(expenses: IPayment[]): IPaymentReportGroupByDate[] {
		const dailyLogs: any = this.groupByDate(expenses).map(
			(byDatePayment: IPayment[], date) => {
				const sum = this.getDurationSum(byDatePayment);
				const byEmployee = this.groupByEmployee(byDatePayment).map(
					(byEmployeePayment: IPayment[]) => {
						const byProject = this.groupByProject(
							byEmployeePayment
						).map((byProjectPayment: IPayment[]) => {
							const project =
								byProjectPayment.length > 0 &&
								byProjectPayment[0]
									? byProjectPayment[0].project
									: null;

							return {
								project,
								expanse: byProjectPayment.map((row) =>
									this.mapPaymentPercentage(row, sum)
								)
							};
						});

						const employee =
							byEmployeePayment.length > 0 && byEmployeePayment[0]
								? byEmployeePayment[0].employee
								: null;
						return {
							employee,
							projects: byProject
						};
					}
				);

				return {
					date,
					employees: byEmployee
				};
			}
		);
		return dailyLogs;
	}

	mapByEmployee(expenses: IPayment[]): IPaymentReportGroupByEmployee[] {
		const byEmployee: any = this.groupByEmployee(expenses).map(
			(byEmployeePayment: IPayment[]) => {
				const sum = this.getDurationSum(byEmployeePayment);
				const dailyLogs = this.groupByDate(byEmployeePayment).map(
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
								expanse: byProjectPayment.map((row) =>
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

				const employee =
					byEmployeePayment.length > 0 && byEmployeePayment[0]
						? byEmployeePayment[0].employee
						: null;
				return {
					employee,
					dates: dailyLogs
				};
			}
		);
		return byEmployee;
	}

	mapByProject(expenses: IPayment[]): IPaymentReportGroupByProject[] {
		const byEmployee: any = this.groupByProject(expenses).map(
			(byProjectPayment: IPayment[]) => {
				const sum = this.getDurationSum(byProjectPayment);

				const dailyLogs = this.groupByDate(byProjectPayment).map(
					(byDatePayment: IPayment[], date) => {
						const byProject = this.groupByEmployee(
							byDatePayment
						).map((byEmployeePayment: IPayment[]) => {
							const employee =
								byEmployeePayment.length > 0 &&
								byEmployeePayment[0]
									? byEmployeePayment[0].employee
									: null;
							return {
								employee,
								expanse: byEmployeePayment.map((row) =>
									this.mapPaymentPercentage(row, sum)
								)
							};
						});

						return {
							date,
							employees: byProject
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
		return byEmployee;
	}

	private groupByProject(expenses: IPayment[]) {
		return chain(expenses).groupBy((expanse) => {
			return expanse.projectId;
		});
	}

	private groupByDate(expenses: IPayment[]) {
		return chain(expenses).groupBy((expanse) => {
			return moment.utc(expanse.paymentDate).format('YYYY-MM-DD');
		});
	}

	private groupByEmployee(expenses: IPayment[]) {
		return chain(expenses).groupBy((expanse) => {
			return expanse.employeeId;
		});
	}

	private mapPaymentPercentage(expanse, sum = 0) {
		expanse.duration_percentage =
			(parseInt(expanse.duration, 10) * 100) / sum;
		return expanse;
	}

	private getDurationSum(expenses) {
		return expenses.reduce((iteratee: any, log: any) => {
			return iteratee + parseInt(log.duration, 10);
		}, 0);
	}
}
