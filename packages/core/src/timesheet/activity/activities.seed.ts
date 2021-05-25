import * as faker from 'faker';
import * as _ from 'underscore';
import * as moment from 'moment';
import { ActivityType, ITenant, ITimeSlot } from '@gauzy/contracts';
import { Activity } from './activity.entity';
import { OrganizationProject } from '../../organization-projects/organization-projects.entity';
import { Connection } from 'typeorm';
import { Employee } from '../../employee/employee.entity';
import { Tenant } from '../../tenant/tenant.entity';
import { TimeSlot } from '../time-slot.entity';

const AppsNames: string[] = [
	'Sublime Text',
	'Chrome',
	'Visual Studio Core',
	'Git Desktop',
	'Slack',
	'Skype',
	'Mail',
	'Terminal'
];

export const createRandomActivities = async (
	connection: Connection,
	tenant: ITenant,
	timeSlots: ITimeSlot[]
): Promise<Activity[]> => {
	const employees = await connection.getRepository(Employee).find();
	const allActivities: Activity[] = [];

	let query = connection
		.getRepository(OrganizationProject)
		.createQueryBuilder();
	query = query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
	const projects: OrganizationProject[] = await query.getMany();

	const appNames: string[] = _.shuffle(AppsNames);

	for (let day = 0; day < 5; day++) {
		const date = moment().subtract(day, 'day').toDate();
		for await (const employee of employees || []) {
			const employeeTimeSlots = timeSlots.filter(
				(x) => x.employeeId === employee.id
			);
			const activities: Activity[] = [];
			for (
				let i = 0;
				i < faker.datatype.number({ min: 0, max: appNames.length });
				i++
			) {
				const appName = appNames[i];
				const project = faker.random.arrayElement(projects);
				const task = faker.random.arrayElement(project.tasks);
				const timeSlot = faker.random.arrayElement(employeeTimeSlots);

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
					faker.date.between(
						moment(date).startOf('day').toDate(),
						moment(date).endOf('day').toDate()
					)
				).format('HH:mm:ss');
				activity.duration = faker.datatype.number(100);
				activity.type = ActivityType.APP;

				activities.push(activity);
			}

			for (let i = 0; i < faker.datatype.number({ min: 0, max: 10 }); i++) {
				const url = faker.internet.domainName();
				for (
					let j = 0;
					j < faker.datatype.number({ min: 5, max: 10 });
					j++
				) {
					const project = faker.random.arrayElement(projects);
					const task = faker.random.arrayElement(project.tasks);
					const timeSlot = faker.random.arrayElement(
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
						title: faker.internet.domainSuffix(),
						description: faker.lorem.sentence()
					};
					activity.description = faker.internet.url();
					activity.date = moment(date).format('YYYY-MM-DD');
					activity.time = moment(
						faker.date.between(
							moment(date).startOf('day').toDate(),
							moment(date).endOf('day').toDate()
						)
					).format('HH:mm:ss');
					activity.duration = faker.datatype.number({
						min: 10,
						max: 100
					});
					activity.type = ActivityType.URL;
					activities.push(activity);
				}
			}
			await connection.manager.save(activities);
			allActivities.push(...allActivities);
		}
	}
	return allActivities;
};
