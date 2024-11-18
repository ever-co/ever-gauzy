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


export const createDefaultRequestApprovalEmployee = async (
	dataSource: DataSource,
	defaultData: {
		employees: IEmployee[];
		orgs: IOrganization[];
		approvalPolicies: ApprovalPolicy[] | void;
	}
): Promise<void> => {
	const requestApprovals: RequestApproval[] = [];
	if (!defaultData.approvalPolicies) {
		console.warn(
			'Warning: Approval Policies not found, Request Approval Employee  will not be created'
		);
		return;
	}

	for await (const org of defaultData.orgs) {

		const requestApproval = new RequestApproval();
		requestApproval.name = faker.helpers.arrayElement(approvalTypes);
		requestApproval.status = faker.number.int({ min: 1, max: 3 });
		requestApproval.approvalPolicy = faker.helpers.arrayElement(defaultData.approvalPolicies);
		requestApproval.min_count = faker.number.int({ min: 1, max: 56 });
		requestApproval.createdBy = faker.helpers.arrayElement(defaultData.employees).id;


		const requestApprovalEmployees: RequestApprovalEmployee[] = [];
		for await (const employee of faker.helpers.arrayElements(defaultData.employees, 5)) {
			const defaultRequestApprovalEmployee = new RequestApprovalEmployee();
			defaultRequestApprovalEmployee.requestApprovalId = faker.helpers.arrayElement(defaultData.approvalPolicies).id;
			defaultRequestApprovalEmployee.employee = employee;
			defaultRequestApprovalEmployee.status = faker.number.int(99);
			defaultRequestApprovalEmployee.tenant = org.tenant;
			defaultRequestApprovalEmployee.organization = org;
			requestApprovalEmployees.push(defaultRequestApprovalEmployee);
		}
		requestApproval.employeeApprovals = requestApprovalEmployees;
		requestApproval.tenant = org.tenant;
		requestApproval.organization = org;
		requestApprovals.push(requestApproval);
	}
	await dataSource.manager.save(requestApprovals);
}


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
				const tenantPolicy = faker.helpers.arrayElement(policies);
				const specificEmployees = employees
					.sort(() => Math.random() - Math.random())
					.slice(0, 3);

				const requestApproval = new RequestApproval();
				requestApproval.name = faker.helpers.arrayElement(approvalTypes);
				requestApproval.status = faker.number.int({ min: 1, max: 3 });
				requestApproval.approvalPolicy = tenantPolicy;
				requestApproval.min_count = faker.number.int({ min: 1, max: 56 });
				requestApproval.createdBy = faker.helpers.arrayElement(specificEmployees).id;

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
