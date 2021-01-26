import { IActivity } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { chain } from 'underscore';

@Injectable()
export class ActivityMapService {
	constructor() {}

	mapByDate(activities: IActivity[]) {
		const dailyLogs: any = this.groupByDate(activities).map(
			(byDateActivity: IActivity[], date) => {
				const sum = this.getDurationSum(byDateActivity);
				console.log({ sum });
				const byEmployee = this.groupByEmployee(byDateActivity).map(
					(byEmployeeActivity: IActivity[]) => {
						const byProject = this.groupByProject(
							byEmployeeActivity
						).map((byProjectActivity: IActivity[]) => {
							const project =
								byProjectActivity.length > 0 &&
								byProjectActivity[0]
									? byProjectActivity[0].project
									: null;

							return {
								project,
								activity: byProjectActivity.map((row) =>
									this.mapActivitiesPercentage(row, sum)
								)
							};
						});

						const employee =
							byEmployeeActivity.length > 0 &&
							byEmployeeActivity[0]
								? byEmployeeActivity[0].employee
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

	mapByEmployee(activities: IActivity[]) {
		const byEmployee: any = this.groupByEmployee(activities).map(
			(byEmployeeActivity: IActivity[]) => {
				const sum = this.getDurationSum(byEmployeeActivity);
				const dailyLogs = this.groupByDate(byEmployeeActivity).map(
					(byDateActivity: IActivity[], date) => {
						const byProject = this.groupByProject(
							byDateActivity
						).map((byProjectActivity: IActivity[]) => {
							const project =
								byProjectActivity.length > 0 &&
								byProjectActivity[0]
									? byProjectActivity[0].project
									: null;
							return {
								project,
								activity: byProjectActivity.map((row) =>
									this.mapActivitiesPercentage(row, sum)
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
					byEmployeeActivity.length > 0 && byEmployeeActivity[0]
						? byEmployeeActivity[0].employee
						: null;
				return {
					employee,
					dates: dailyLogs
				};
			}
		);
		return byEmployee;
	}

	mapByProject(activities: IActivity[]) {
		const byEmployee: any = this.groupByProject(activities).map(
			(byProjectActivity: IActivity[]) => {
				const sum = this.getDurationSum(byProjectActivity);

				const dailyLogs = this.groupByDate(byProjectActivity).map(
					(byDateActivity: IActivity[], date) => {
						const byProject = this.groupByEmployee(
							byDateActivity
						).map((byEmployeeActivity: IActivity[]) => {
							const employee =
								byEmployeeActivity.length > 0 &&
								byEmployeeActivity[0]
									? byEmployeeActivity[0].employee
									: null;
							return {
								employee,
								activity: byEmployeeActivity.map((row) =>
									this.mapActivitiesPercentage(row, sum)
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
					byProjectActivity.length > 0 && byProjectActivity[0]
						? byProjectActivity[0].project
						: null;
				return {
					project,
					dates: dailyLogs
				};
			}
		);
		return byEmployee;
	}

	private groupByProject(activities: IActivity[]) {
		return chain(activities).groupBy((activity) => {
			return activity.projectId;
		});
	}

	private groupByDate(activities: IActivity[]) {
		return chain(activities).groupBy((activity) => {
			return moment.utc(activity.date).format('YYYY-MM-DD');
		});
	}

	private groupByEmployee(activities: IActivity[]) {
		return chain(activities).groupBy((activity) => {
			return activity.employeeId;
		});
	}

	private mapActivitiesPercentage(activity, sum = 0) {
		activity.duration_percentage =
			(parseInt(activity.duration, 10) * 100) / sum;
		return activity;
	}

	private getDurationSum(activities) {
		return activities.reduce((iteratee: any, log: any) => {
			return iteratee + parseInt(log.duration, 10);
		}, 0);
	}
}
