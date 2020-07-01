import * as faker from 'faker';
import * as _ from 'underscore';
import * as moment from 'moment';
import { ActivityType } from '@gauzy/models';
import { Activity } from '../activity.entity';
import { OrganizationProjects } from '../../organization-projects/organization-projects.entity';
import { Connection } from 'typeorm';
import { Employee } from '../../employee/employee.entity';

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
const Uls: string[] = [
	'localhost',
	'google.com',
	'github.com',
	'akveo.github.io',
	'stackblitz.com',
	'stackoverflow.com'
];

export const createRandomActivities = async (connection: Connection) => {
	const activities: Activity[] = [];

	const employees = await connection.getRepository(Employee).find();

	let query = connection
		.getRepository(OrganizationProjects)
		.createQueryBuilder();
	query = query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
	const projects: OrganizationProjects[] = await query.getMany();

	const appNames: string[] = _.shuffle(AppsNames);

	for (let day = 0; day < 30; day++) {
		const date = moment().subtract(day, 'day').toDate();
		for (let i = 0; i < faker.random.number(appNames.length); i++) {
			const appName = appNames[i];
			const project = faker.random.arrayElement(projects);
			const task = faker.random.arrayElement(project.tasks);

			const activity = new Activity();
			activity.employee = faker.random.arrayElement(employees);
			activity.project = project;
			activity.task = task;
			activity.title = appName;
			activity.date = date;
			activity.duration = faker.random.number(100);
			activity.type = ActivityType.APP;

			activities.push(activity);
		}

		const urls: string[] = _.shuffle(Uls);
		for (let i = 0; i < faker.random.number(urls.length); i++) {
			const url = urls[i];
			const project = faker.random.arrayElement(projects);
			const task = faker.random.arrayElement(project.tasks);

			const activity = new Activity();
			activity.employee = faker.random.arrayElement(employees);
			activity.project = project;
			activity.task = task;
			activity.title = url;
			activity.date = date;
			activity.duration = faker.random.number(100);
			activity.type = ActivityType.URL;

			activities.push(activity);
		}
	}
	await connection.manager.save(activities);

	return activities;
};
