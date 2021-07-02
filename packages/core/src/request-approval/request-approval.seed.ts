import { Connection } from 'typeorm';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { Tenant } from '../tenant/tenant.entity';
import * as faker from 'faker';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';

const approvalTypes = [
	'Business Trip',
	'Contract Approval',
	'Payment for Software',
	'Car Rental',
	'Job Referral Award',
	'Best Employee Award',
	'Christmas Bonus',
	'Payment for Hardware',
	'Payment for Service Provider',
	'Loyalty Rewards',
	'Bonus',
	'Holiday Stay',
	'Payment for Electric gadgets',
	'Health Meal'
];

export const createRandomRequestApproval = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	noOfRequestsPerOrganizations: number
): Promise<any> => {
	const requestApprovals: RequestApproval[] = [];
	for await (const tenant of tenants || []) {
		const policies: ApprovalPolicy[] = await connection.manager.find(ApprovalPolicy, {
				where: {
					tenant
				}
			}
		);
		const organizations = await connection.manager.find(Organization, {
			where: {
				tenant
			}
		});

		for await (const organization of organizations) {
			for (let i = 0; i < noOfRequestsPerOrganizations; i++) {
				const tenantPolicy = faker.random.arrayElement(policies);
				const employees = tenantEmployeeMap.get(tenant);
				const specificEmployees = employees
					.sort(() => Math.random() - Math.random())
					.slice(0, 3);
	
				const requestApproval = new RequestApproval();
				requestApproval.name = faker.random.arrayElement(approvalTypes);
				requestApproval.status = faker.datatype.number({ min: 1, max: 3 });
				requestApproval.approvalPolicy = tenantPolicy;
				requestApproval.min_count = faker.datatype.number({ min: 1, max: 56 });
				requestApproval.createdBy = faker.random.arrayElement(specificEmployees).id;
	
				const requestApprovalEmployees: RequestApprovalEmployee[] = [];
				for await (const employee of specificEmployees) {
					const raEmployees = new RequestApprovalEmployee();
					raEmployees.employee = employee;
					raEmployees.tenant = tenant;
					raEmployees.organization = organization;
					raEmployees.status = requestApproval.status;
					requestApprovalEmployees.push(raEmployees);
				}
				requestApproval.employeeApprovals = requestApprovalEmployees;

				requestApproval.tenant = tenant;
				requestApproval.organization = organization;
				requestApprovals.push(requestApproval);
			}
		}
	}

	await connection
		.createQueryBuilder()
		.insert()
		.into(RequestApproval)
		.values(requestApprovals)
		.execute();
};