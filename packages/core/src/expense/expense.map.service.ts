import {
	IExpense,
	IExpenseReportGroupByDate,
	IExpenseReportGroupByEmployee,
	IExpenseReportGroupByProject
} from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { chain } from 'underscore';

@Injectable()
export class ExpenseMapService {
	constructor() {}

	mapByDate(expenses: IExpense[]): IExpenseReportGroupByDate[] {
		const dailyLogs: any = this.groupByDate(expenses).map(
			(byDateExpense: IExpense[], date) => {
				const sum = this.getDurationSum(byDateExpense);
				const byEmployee = this.groupByEmployee(byDateExpense).map(
					(byEmployeeExpense: IExpense[]) => {
						const byProject = this.groupByProject(
							byEmployeeExpense
						).map((byProjectExpense: IExpense[]) => {
							const project =
								byProjectExpense.length > 0 &&
								byProjectExpense[0]
									? byProjectExpense[0].project
									: null;

							return {
								project,
								expanse: byProjectExpense.map((row) =>
									this.mapExpensePercentage(row, sum)
								)
							};
						});

						const employee =
							byEmployeeExpense.length > 0 && byEmployeeExpense[0]
								? byEmployeeExpense[0].employee
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

	mapByEmployee(expenses: IExpense[]): IExpenseReportGroupByEmployee[] {
		const byEmployee: any = this.groupByEmployee(expenses).map(
			(byEmployeeExpense: IExpense[]) => {
				const sum = this.getDurationSum(byEmployeeExpense);
				const dailyLogs = this.groupByDate(byEmployeeExpense).map(
					(byDateExpense: IExpense[], date) => {
						const byProject = this.groupByProject(
							byDateExpense
						).map((byProjectExpense: IExpense[]) => {
							const project =
								byProjectExpense.length > 0 &&
								byProjectExpense[0]
									? byProjectExpense[0].project
									: null;
							return {
								project,
								expanse: byProjectExpense.map((row) =>
									this.mapExpensePercentage(row, sum)
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
					byEmployeeExpense.length > 0 && byEmployeeExpense[0]
						? byEmployeeExpense[0].employee
						: null;
				return {
					employee,
					dates: dailyLogs
				};
			}
		);
		return byEmployee;
	}

	mapByProject(expenses: IExpense[]): IExpenseReportGroupByProject[] {
		const byEmployee: any = this.groupByProject(expenses).map(
			(byProjectExpense: IExpense[]) => {
				const sum = this.getDurationSum(byProjectExpense);

				const dailyLogs = this.groupByDate(byProjectExpense).map(
					(byDateExpense: IExpense[], date) => {
						const byProject = this.groupByEmployee(
							byDateExpense
						).map((byEmployeeExpense: IExpense[]) => {
							const employee =
								byEmployeeExpense.length > 0 &&
								byEmployeeExpense[0]
									? byEmployeeExpense[0].employee
									: null;
							return {
								employee,
								expanse: byEmployeeExpense.map((row) =>
									this.mapExpensePercentage(row, sum)
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
					byProjectExpense.length > 0 && byProjectExpense[0]
						? byProjectExpense[0].project
						: null;
				return {
					project,
					dates: dailyLogs
				};
			}
		);
		return byEmployee;
	}

	private groupByProject(expenses: IExpense[]) {
		return chain(expenses).groupBy((expanse) => {
			return expanse.projectId;
		});
	}

	private groupByDate(expenses: IExpense[]) {
		return chain(expenses).groupBy((expanse) => {
			return moment.utc(expanse.valueDate).format('YYYY-MM-DD');
		});
	}

	private groupByEmployee(expenses: IExpense[]) {
		return chain(expenses).groupBy((expanse) => {
			return expanse.employeeId;
		});
	}

	private mapExpensePercentage(expanse, sum = 0) {
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
