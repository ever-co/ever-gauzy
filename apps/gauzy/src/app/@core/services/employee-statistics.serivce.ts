import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	AggregatedEmployeeStatistic,
	AggregatedEmployeeStatisticFindInput,
	EmployeeStatistics,
	EmployeeStatisticsFindInput,
	MonthAggregatedEmployeeStatisticsFindInput,
	MonthAggregatedEmployeeStatistics
} from '@gauzy/models';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EmployeeStatisticsService {
	constructor(private http: HttpClient) {}
	avarageBonus$ = new Subject<number>();

	/**
	 * Gets the aggregated statistics for all employees of the organization from the start of time till now.
	 * If date is provided in findInput it will return only for the month selected.
	 */
	getAggregateStatisticsByOrganizationId(
		findInput?: AggregatedEmployeeStatisticFindInput
	): Promise<AggregatedEmployeeStatistic> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<AggregatedEmployeeStatistic>(
				`/api/employee-statistics/aggregate`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	/**
	 * Gets the statistics for the selected employee for the last 12 months.
	 * If date is provided in findInput it will return only for the month selected.
	 * @param employeeId The id of the employee.
	 * @param findInput Object containing valueDate.
	 * @returns Promise<EmployeeStatistics>
	 */
	getStatisticsByEmployeeId(
		employeeId: string,
		findInput?: EmployeeStatisticsFindInput
	): Promise<EmployeeStatistics> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<EmployeeStatistics>(
				`/api/employee-statistics/months/${employeeId}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
	/**
	 * Gets the statistics for the selected employee for the last N months.
	 * @param findInput Object containing valueDate, employeeId, Months.
	 * @returns Promise<MonthAggregatedEmployeeStatistics[]>
	 */
	getAggregatedStatisticsByEmployeeId(
		findInput: MonthAggregatedEmployeeStatisticsFindInput
	): Promise<MonthAggregatedEmployeeStatistics[]> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<MonthAggregatedEmployeeStatistics[]>(
				`/api/employee-statistics/months`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
}
