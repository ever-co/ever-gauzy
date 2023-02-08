import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';

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
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
	noOfRequestsPerOrganizations: number
): Promise<any> => {
	const requestApprovals: RequestApproval[] = [];
	for await (const tenant of tenants || []) {
		const { id: tenantId } = tenant;

		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const employees = organizationEmployeesMap.get(organization);
			const policies: ApprovalPolicy[] = await dataSource.manager.find(ApprovalPolicy, {
				where: {
					tenantId,
					organizationId: organization.id
				}
			}
			);
			for (let i = 0; i < noOfRequestsPerOrganizations; i++) {
				const tenantPolicy = faker.random.arrayElement(policies);
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

	await dataSource
		.createQueryBuilder()
		.insert()
		.into(RequestApproval)
		.values(requestApprovals)
		.execute();
};
