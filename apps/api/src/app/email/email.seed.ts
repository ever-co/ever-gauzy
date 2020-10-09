import { Connection } from 'typeorm';
import { Email } from './email.entity';
import * as faker from 'faker';
import { EmailTemplate } from '../email-template/email-template.entity';
import { Tenant } from '../tenant/tenant.entity';
import { IOrganization } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';

export const createDefaultEmailSent = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization,
	noOfEmailsPerOrganization: number
): Promise<any> => {
	const emailTemplates = await connection.getRepository(EmailTemplate).find();

	let sentEmails: Email[] = [];
	// for(let organization of Organizations){
	sentEmails = await dataOperation(
		connection,
		sentEmails,
		noOfEmailsPerOrganization,
		organization,
		emailTemplates,
		tenant
	);
	// }
	return sentEmails;
};

export const createRandomEmailSent = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>,
	noOfEmailsPerOrganization: number
): Promise<any> => {
	const emailTemplates = await connection.getRepository(EmailTemplate).find();

	let sentEmails: Email[] = [];
	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		for (const org of orgs) {
			sentEmails = await dataOperation(
				connection,
				sentEmails,
				noOfEmailsPerOrganization,
				org,
				emailTemplates,
				tenant
			);
		}
	}
	return sentEmails;
};

const dataOperation = async (
	connection: Connection,
	sentEmails,
	noOfEmailsPerOrganization,
	organization,
	emailTemplates,
	tenant
) => {
	for (let i = 0; i < noOfEmailsPerOrganization; i++) {
		const sentEmail = new Email();
		sentEmail.organizationId = organization.id;
		sentEmail.email = faker.internet.email();
		sentEmail.emailTemplate = faker.random.arrayElement(
			emailTemplates.filter((x) => !x.name.includes('subject'))
		);
		sentEmail.name = sentEmail.emailTemplate.name.split('/')[0];
		sentEmail.content = sentEmail.emailTemplate.hbs;
		sentEmail.tenant = tenant;
		sentEmails.push(sentEmail);
	}
	await connection.manager.save(sentEmails);
	return sentEmails;
};
