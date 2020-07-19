import { Connection } from 'typeorm';
import { Invite } from './invite.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import * as faker from 'faker';
import { InviteStatusEnum, RolesEnum } from '@gauzy/models';
import { Role } from '../role/role.entity';
import { sign } from 'jsonwebtoken';
import { environment as env } from '@env-api/environment';
import { User } from '../user/user.entity';

export const createRandomEmployeeInviteSent = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantSuperAdminMap: Map<Tenant, User[]>,
	noOfInvitesPerOrganization: number
): Promise<any> => {
	let totalInvites: Invite[] = [];
	let invitationStatus = Object.values(InviteStatusEnum);

	for (const tenant of tenants) {
		const role = await connection.getRepository(Role).find({
			where: [{ tenant: tenant }, { name: RolesEnum.EMPLOYEE }]
		});
		const orgs = tenantOrganizationsMap.get(tenant);
		const admins = tenantSuperAdminMap.get(tenant);
		orgs.forEach((org) => {
			for (let i = 0; i < noOfInvitesPerOrganization; i++) {
				let invitee = new Invite();
				invitee.email = faker.internet.email();
				invitee.expireDate = faker.date.future();
				invitee.invitedBy = faker.random.arrayElement(admins);
				invitee.organizationId = org.id;
				invitee.organization = org;
				invitee.role = role[0];
				invitee.status = faker.random.arrayElement(invitationStatus);
				invitee.token = createToken(invitee.email);
				totalInvites.push(invitee);
			}
		});
	}
	await connection.manager.save(totalInvites);
};

function createToken(email): string {
	const token: string = sign({ email }, env.JWT_SECRET, {});
	return token;
}
