import { IActivity } from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { chain } from 'underscore';

@Injectable()
export class ActivityMapService {
	constructor() {}

	mapByDate(activities: IActivity[]) {
		const dailyLogs: any = this.groupByDate(activities).map(
			(byDateActivity: IActivity[], date) => {
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
								activity: byProjectActivity
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
								activity: byProjectActivity
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
								activity: byEmployeeActivity
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
			console.log(activity);
			return activity.date;
			//return moment.utc(activity.date + ' ' + activity.time).format('YYYY-MM-DD')
		});
	}

	private groupByEmployee(activities: IActivity[]) {
		return chain(activities).groupBy((activity) => {
			return activity.employeeId;
		});
	}
}
