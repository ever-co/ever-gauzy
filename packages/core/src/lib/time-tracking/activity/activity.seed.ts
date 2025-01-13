import { faker } from '@faker-js/faker';
import * as _ from 'underscore';
import * as moment from 'moment';
import { DataSource } from 'typeorm';
import { ActivityType, ITenant, ITimeSlot } from '@gauzy/contracts';
import { getRandomElement } from '@gauzy/utils';
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

/**
 * Creates random activities for the given tenant and time slots.
 *
 * @param dataSource - The TypeORM data source.
 * @param tenant - The tenant for which activities are created.
 * @param timeSlots - The time slots to associate with activities.
 * @returns A promise that resolves to an array of created activities.
 */
export const createRandomActivities = async (
    dataSource: DataSource,
    tenant: ITenant,
    timeSlots: ITimeSlot[]
): Promise<Activity[]> => {
    const { id: tenantId } = tenant;

    // Fetch employees for the tenant
    const employees = await dataSource.manager.findBy(Employee, { tenantId });

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

        for (const employee of employees) {
            const employeeTimeSlots = timeSlots.filter(
                (slot) => slot.employeeId === employee.id
            );

            // Generate activities for apps
            const appActivities = generateActivitiesForApps(
                appNames,
                projects,
                employeeTimeSlots,
                employee,
                tenant,
                date
            );

            // Generate activities for URLs
            const urlActivities = generateActivitiesForUrls(
                projects,
                employeeTimeSlots,
                employee,
                tenant,
                date
            );

            // Save activities to the database
            const activities = [...appActivities, ...urlActivities];
            await dataSource.manager.save(activities);
            allActivities.push(...activities);
        }
    }

    return allActivities;
};

/**
 * Generates activities for apps.
 *
 * @param appNames - The list of app names.
 * @param projects - The list of projects.
 * @param timeSlots - The list of time slots for the employee.
 * @param employee - The employee associated with the activities.
 * @param tenant - The tenant associated with the activities.
 * @param date - The date for the activities.
 * @returns An array of generated app activities.
 */
const generateActivitiesForApps = (
    appNames: string[],
    projects: OrganizationProject[],
    timeSlots: ITimeSlot[],
    employee: Employee,
    tenant: ITenant,
    date: Date
): Activity[] => {
    return appNames.slice(0, faker.number.int({ min: 0, max: appNames.length })).map((appName) => {
        const project = getRandomElement(projects);
        const task = getRandomElement(project?.tasks || []);
        const timeSlot = getRandomElement(timeSlots);

        const activity = new Activity();
        activity.organizationId = employee.organizationId;
        activity.tenant = tenant;
        activity.employee = employee;
        activity.project = project;
        activity.timeSlot = timeSlot;
        activity.task = task;
        activity.title = appName;
        activity.date = moment(date).format('YYYY-MM-DD');
        activity.time = generateRandomTime(date);
        activity.recordedAt = date;
        activity.duration = faker.number.int(100);
        activity.type = ActivityType.APP;

        return activity;
    });
};

/**
 * Generates activities for URLs.
 *
 * @param projects - The list of projects.
 * @param timeSlots - The list of time slots for the employee.
 * @param employee - The employee associated with the activities.
 * @param tenant - The tenant associated with the activities.
 * @param date - The date for the activities.
 * @returns An array of generated URL activities.
 */
const generateActivitiesForUrls = (
    projects: OrganizationProject[],
    timeSlots: ITimeSlot[],
    employee: Employee,
    tenant: ITenant,
    date: Date
): Activity[] => {
    return Array.from({ length: faker.number.int({ min: 0, max: 10 }) }).flatMap(() => {
        const url = faker.internet.domainName();

        return Array.from({ length: faker.number.int({ min: 5, max: 10 }) }).map(() => {
            const project = getRandomElement(projects);
            const task = getRandomElement(project?.tasks || []);
            const timeSlot = getRandomElement(timeSlots);

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
            activity.time = generateRandomTime(date);
            activity.duration = faker.number.int({ min: 10, max: 100 });
            activity.type = ActivityType.URL;

            return activity;
        });
    });
};

/**
 * Generates a random time for a given date.
 *
 * @param date - The date for the random time.
 * @returns A string representing the random time in HH:mm:ss format.
 */
const generateRandomTime = (date: Date): string => {
    return moment(
        faker.date.between({
            from: moment(date).startOf('day').toDate(),
            to: moment(date).endOf('day').toDate()
        })
    ).format('HH:mm:ss');
};
