import { Connection } from 'typeorm';
import { Email } from './email.entity';
import * as faker from 'faker';
import { EmailTemplate } from '../email-template/email-template.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '@gauzy/models';

export const createDefaultEmailSent = async (
  connection: Connection,
  Organization,
  noOfEmailsPerOrganization: number
): Promise<any> => {
  const emailTemplates = await connection.getRepository(EmailTemplate).find();

  let sentEmails: Email[] = [];
  // for(let organization of Organizations){
      sentEmails = await dataOperation(connection, sentEmails, noOfEmailsPerOrganization, Organization, emailTemplates);
  // }
  return sentEmails;
};

export const createRandomEmailSent = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	noOfEmailsPerOrganization: number
): Promise<any> => {
	const emailTemplates = await connection.getRepository(EmailTemplate).find();

	let sentEmails: Email[] = [];
	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		for(let org of orgs){
      sentEmails = await dataOperation(connection, sentEmails, noOfEmailsPerOrganization, org, emailTemplates);
    }
	}
	return sentEmails;
};

const dataOperation = async (connection: Connection, sentEmails, noOfEmailsPerOrganization, organization, emailTemplates)=>{
  for (let i = 0; i < noOfEmailsPerOrganization; i++) {
    let sentEmail = new Email();
    sentEmail.organizationId = organization.id;
    sentEmail.email = faker.internet.email();
    sentEmail.emailTemplate = faker.random.arrayElement(
      emailTemplates.filter((x) => !x.name.includes('subject'))
    );
    sentEmail.name = sentEmail.emailTemplate.name.split('/')[0];
    sentEmail.content = sentEmail.emailTemplate.hbs;
    sentEmails.push(sentEmail);
  }
  await connection.manager.save(sentEmails);
  return sentEmails;
}
