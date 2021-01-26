import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { EstimateEmail } from './estimate-email.entity';
import * as faker from 'faker';
import { sign } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';

export const createRandomEstimateEmail = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, IEmployee[]>,
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
): Promise<EstimateEmail[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, deal  will not be created'
		);
		return;
	}
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, deal  will not be created'
		);
		return;
	}

	const estimateEmails: EstimateEmail[] = [];

	for (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);

		for (const tenantEmployee of tenantEmployees) {
			const estimateEmail = new EstimateEmail();
			let newDate = faker.date.recent();
			newDate.setMinutes(faker.date.recent().getMinutes() + 15);
			estimateEmail.token = createToken(tenantEmployee.user.email);
			estimateEmail.email = tenantEmployee.user.email;
			estimateEmail.expireDate = newDate;

			estimateEmails.push(estimateEmail);
		}
	}

	await connection.manager.save(estimateEmails);
};

function createToken(email): string {
	const token: string = sign({ email }, env.JWT_SECRET, {});
	return token;
}
