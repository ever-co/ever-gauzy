import { Connection, ILike, Not } from 'typeorm';
import { Email } from './email.entity';
import * as faker from 'faker';
import { IEmail, IEmailTemplate, IOrganization, ITenant, IUser } from '@gauzy/contracts';
import { EmailTemplate, User } from './../core/entities/internal';

export const createDefaultEmailSent = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization,
	noOfEmailsPerOrganization: number
): Promise<any> => {
	const emailTemplates: IEmailTemplate[] = await connection.getRepository(EmailTemplate).find({
		where: {
			name: Not(ILike(`%subject%`))
		}
	});
	const users: IUser[] = await connection.getRepository(User).find();

	let sentEmails: IEmail[] = [];
	sentEmails = await dataOperation(
		connection,
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
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	noOfEmailsPerOrganization: number
): Promise<any> => {
	const emailTemplates: IEmailTemplate[] = await connection.getRepository(EmailTemplate).find({
		where: {
			name: Not(ILike(`%subject%`))
		}
	});

	let sentEmails: IEmail[] = [];
	for (const tenant of tenants) {
		const users = await connection.getRepository(User).find({
			where: {
				tenant
			}
		});
		const orgs = tenantOrganizationsMap.get(tenant);
		for (const org of orgs) {
			sentEmails = await dataOperation(
				connection,
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
	connection: Connection,
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
		sentEmail.email = faker.internet.email();
		sentEmail.emailTemplate = faker.random.arrayElement(emailTemplates);
		sentEmail.name = sentEmail.emailTemplate.name.split('/')[0];
		sentEmail.content = sentEmail.emailTemplate.hbs;
		sentEmail.tenant = tenant;
		sentEmail.user = faker.random.arrayElement(users);
		sentEmails.push(sentEmail);
	}
	await connection.manager.save(sentEmails);
	return sentEmails;
};
