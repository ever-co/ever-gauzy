import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sign } from 'jsonwebtoken';
import * as moment from 'moment';
import { ICreateInviteSeedParams, InviteStatusEnum, IOrganization, ITenant, IUser } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { Invite } from './invite.entity';
import { Role } from '../core/entities/internal';
import { getEmailWithPostfix } from '../core/seeds/utils';

/**
 * Creates default employee invites for a given tenant.
 *
 * @param dataSource - The DataSource instance for database operations.
 * @param tenant - The tenant for which to create invites.
 * @param organizations - The organizations associated with the tenant.
 * @param superAdmins - An array of super admin users.
 */
export const createDefaultEmployeeInviteSent = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	superAdmins: IUser[]
): Promise<Invite[]> => {
	const { id: tenantId } = tenant;
	const roles = await dataSource.manager.findBy(Role, { tenantId });

	const totalInvites = organizations.flatMap((organization: IOrganization) => {
		// Get the organization ID
		const { id: organizationId } = organization;
		// Create 10 invites for each organization
		return Array.from({ length: 10 }).map(() => {
			return createInvite({
				superAdmins,
				organizationId,
				tenantId,
				roles
			});
		});
	});

	return await insertBulkInvites(dataSource, totalInvites);
};

/**
 * Creates random employee invites for each tenant.
 *
 * @param dataSource - The TypeORM DataSource instance for database operations.
 * @param tenants - An array of tenant objects.
 * @param tenantOrganizationsMap - A map of tenants to their respective organizations.
 * @param tenantSuperAdminMap - A map of tenants to their super admin users.
 * @param noOfInvitesPerOrganization - The number of invites to generate for each organization.
 * @returns A promise that resolves when all invites have been saved.
 */
export const createRandomEmployeeInviteSent = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	tenantSuperAdminMap: Map<ITenant, IUser[]>,
	noOfInvitesPerOrganization: number
): Promise<Invite[]> => {
	const totalInvites: Invite[] = [];

	// Process each tenant concurrently
	await Promise.all(
		tenants.map(async (tenant) => {
			const { id: tenantId } = tenant;
			// Get the tenant's roles
			const roles = await dataSource.manager.findBy(Role, { tenantId });
			// Get the tenant's organizations
			const organizations = tenantOrganizationsMap.get(tenant) || [];
			// Get the tenant's super admins
			const superAdmins = tenantSuperAdminMap.get(tenant) || [];

			// Iterate over each organization
			organizations.forEach((organization: IOrganization) => {
				// Get the organization ID
				const { id: organizationId } = organization;

				Array.from({ length: noOfInvitesPerOrganization }).forEach(() => {
					const invite = createInvite({
						superAdmins,
						organizationId,
						tenantId,
						roles
					});
					totalInvites.push(invite);
				});
			});
		})
	);

	return await insertBulkInvites(dataSource, totalInvites);
};

/**
 * Creates a JWT token containing the provided email as payload.
 *
 * @param email - The email address to embed in the token.
 * @returns A JWT token string.
 */
export function createToken(email: string): string {
	const token: string = sign({ email }, env.JWT_SECRET, {});
	return token;
}

/**
 * Creates a new Invite entity with randomized data.
 *
 * @param params - The parameters needed to create an invite.
 * @returns A new Invite instance.
 */
export function createInvite({ superAdmins, organizationId, tenantId, roles }: ICreateInviteSeedParams): Invite {
	const now = new Date();
	const expireDateEnd = moment(now).add(30, 'days').toDate();

	const invite = new Invite();
	invite.email = getEmailWithPostfix(faker.internet.exampleEmail());
	invite.expireDate = faker.date.between({ from: now, to: expireDateEnd });
	invite.invitedByUser = superAdmins.length
		? faker.helpers.arrayElement(superAdmins)
		: undefined; // Or fallback to a known user
	invite.organizationId = organizationId;
	invite.tenantId = tenantId;
	invite.role = faker.helpers.arrayElement(roles);
	invite.status = faker.helpers.arrayElement(Object.values(InviteStatusEnum));
	invite.token = createToken(invite.email);
	return invite;
}

/**
 * Inserts multiple Invite records into the database efficiently.
 *
 * @param dataSource - The DataSource instance connected to the database.
 * @param invites - An array of Invite entities to be inserted.
 * @param batchSize - The batch size to control the number of records inserted per query (default is 100).
 * @returns A promise that resolves to an array of inserted Invite records.
 * @throws An error if the insertion fails.
 */
export const insertBulkInvites = async (
	dataSource: DataSource,
	invites: Invite[],
	batchSize = 100
): Promise<Invite[]> => {
	if (!invites.length) {
		console.warn('No invites to insert. Please check the input data and try again.');
		return [];
	}

	try {
		const repository = dataSource.getRepository(Invite);
		return await repository.save(invites, { chunk: batchSize });
	} catch (error) {
		console.error('Error while inserting bulk invites:', error);
		return [];
	}
};
