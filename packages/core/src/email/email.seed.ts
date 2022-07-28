import { DataSource, ILike, Not } from 'typeorm';
import { Email } from './email.entity';
import { faker } from '@ever-co/faker';
import { IEmail, IEmailTemplate, IOrganization, ITenant, IUser } from '@gauzy/contracts';
import { EmailTemplate, User } from './../core/entities/internal';

export const createDefaultEmailSent = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	noOfEmailsPerOrganization: number
): Promise<any> => {
	const emailTemplates: IEmailTemplate[] = await dataSource.manager.findBy(EmailTemplate, {
		name: Not(ILike(`%subject%`))
	});
	const users: IUser[] = await dataSource.getRepository(User).find();

	let sentEmails: IEmail[] = [];
	sentEmails = await dataOperation(
		dataSource,
		sentEmails,
		noOfEmailsPerOrganization,
		organization,
		emailTemplates,
		tenant,
		users
	);
	return sentEmails;
};

export const createRandomEmailSent = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	noOfEmailsPerOrganization: number
): Promise<any> => {
	const emailTemplates: IEmailTemplate[] = await dataSource.manager.findBy(EmailTemplate, {
		name: Not(ILike(`%subject%`))
	});

	let sentEmails: IEmail[] = [];
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const users = await dataSource.manager.findBy(User, {
			tenantId
		});
		const orgs = tenantOrganizationsMap.get(tenant);
		for (const org of orgs) {
			sentEmails = await dataOperation(
				dataSource,
				sentEmails,
				noOfEmailsPerOrganization,
				org,
				emailTemplates,
				tenant,
				users
			);
		}
	}
	return sentEmails;
};

const dataOperation = async (
	dataSource: DataSource,
	sentEmails: IEmail[],
	noOfEmailsPerOrganization,
	organization: IOrganization,
	emailTemplates,
	tenant: ITenant,
	users: IUser[]
) => {
	for (let i = 0; i < noOfEmailsPerOrganization; i++) {
		const sentEmail = new Email();
		sentEmail.organization = organization;
		sentEmail.email = faker.internet.exampleEmail();
		sentEmail.emailTemplate = faker.random.arrayElement(emailTemplates);
		sentEmail.name = sentEmail.emailTemplate.name.split('/')[0];
		sentEmail.content = sentEmail.emailTemplate.hbs;
		sentEmail.tenant = tenant;
		sentEmail.user = faker.random.arrayElement(users);
		sentEmails.push(sentEmail);
	}
	await dataSource.manager.save(sentEmails);
	return sentEmails;
};
