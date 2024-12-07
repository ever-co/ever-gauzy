import { faker } from '@faker-js/faker';
import * as _ from 'underscore';
import * as moment from 'moment';
import { DataSource } from 'typeorm';
import { ActivityType, ITenant, ITimeSlot } from '@gauzy/contracts';
import { Activity } from './activity.entity';
import { OrganizationProject } from './../../core/entities/internal';
import { Employee } from '../../employee/employee.entity';
import { prepareSQLQuery as p } from './../../database/database.helper';

export const AppsNames: string[] = [
	'Sublime Text',
	'Chrome',
	'Visual Studio Core',
	'Git Desktop',
	'Slack',
	'Skype',
	'Mail',
	'Terminal',
	"Desktop Timer",
	"PgAdmin"
];

export const createRandomActivities = async (
	dataSource: DataSource,
	tenant: ITenant,
	timeSlots: ITimeSlot[]
): Promise<Activity[]> => {
	const { id: tenantId } = tenant;
	const employees = await dataSource.manager.findBy(Employee, {
		tenantId
	});

	let query = dataSource
		.getRepository(OrganizationProject)
		.createQueryBuilder();
	query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
	query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId: tenant.id });

	const projects: OrganizationProject[] = await query.getMany();

	const appNames: string[] = _.shuffle(AppsNames);
	const allActivities: Activity[] = [];

	for (let day = 0; day < 5; day++) {
		const date = moment().subtract(day, 'day').toDate();
		for await (const employee of employees || []) {
			const employeeTimeSlots = timeSlots.filter(
				(x) => x.employeeId === employee.id
			);
			const activities: Activity[] = [];
			for (
				let i = 0;
				i < faker.number.int({ min: 0, max: appNames.length });
				i++
			) {
				const appName = appNames[i];
				const project = faker.helpers.arrayElement(projects);
				const task = faker.helpers.arrayElement(project.tasks);
				const timeSlot = faker.helpers.arrayElement(employeeTimeSlots);

				const activity = new Activity();
				activity.organizationId = employee.organizationId;
				activity.tenant = tenant;
				activity.employee = employee;
				activity.project = project;
				activity.timeSlot = timeSlot;
				activity.task = task;
				activity.title = appName;
				activity.date = moment(date).format('YYYY-MM-DD');
				activity.time = moment(
					faker.date.between({
						from: moment(date).startOf('day').toDate(),
						to: moment(date).endOf('day').toDate()
					})
				).format('HH:mm:ss');

				activity.recordedAt = moment(date).toDate();
				activity.duration = faker.number.int(100);
				activity.type = ActivityType.APP;

				activities.push(activity);
			}

			for (let i = 0; i < faker.number.int({ min: 0, max: 10 }); i++) {
				const url = faker.internet.domainName();
				for (
					let j = 0;
					j < faker.number.int({ min: 5, max: 10 });
					j++
				) {
					const project = faker.helpers.arrayElement(projects);
					const task = faker.helpers.arrayElement(project.tasks);
					const timeSlot = faker.helpers.arrayElement(
						employeeTimeSlots
					);

					const activity = new Activity();
					activity.organizationId = employee.organizationId;
					activity.tenant = tenant;
					activity.employee = employee;
					activity.project = project;
					activity.timeSlot = timeSlot;
					activity.task = task;
					activity.title = url;
					activity.metaData = {
						url: faker.internet.url(),
						title: faker.internet.domainSuffix(),
						description: faker.lorem.sentence()
					};
					activity.description = faker.lorem.sentence();
					activity.date = moment(date).format('YYYY-MM-DD');
					activity.time = moment(
						faker.date.between({
							from: moment(date).startOf('day').toDate(),
							to: moment(date).endOf('day').toDate()
						})
					).format('HH:mm:ss');
					activity.duration = faker.number.int({
						min: 10,
						max: 100
					});
					activity.type = ActivityType.URL;
					activities.push(activity);
				}
			}
			await dataSource.manager.save(activities);
			allActivities.push(...allActivities);
		}
	}
	return allActivities;
};
