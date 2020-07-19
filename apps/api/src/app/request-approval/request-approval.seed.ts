import { Connection } from 'typeorm';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { Tenant } from '../tenant/tenant.entity';
import * as faker from 'faker';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { Employee } from '../employee/employee.entity';

const approvalTypes =[
  "Business Trip",
  "Contract Approval",
  "Payment for Software",
  "Car Rental",
  "Job Referral Award",
  "Best Employee Award",
  "Christmas Bonus",
  "Payment for Hardware",
  "Payment for Service Provider",
  "Loyalty Rewards",
  "Bonus",
  "Holiday Stay",
  "Payment for Electric gadgets",
  "Health Meal"
];


export const createRandomRequestApproval = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	noOfRequestsPerOrganizations: number
): Promise<any> => {
	let requestApprovals: RequestApproval[] = [];
	let policies: ApprovalPolicy[] = await connection.manager.find(
		ApprovalPolicy
	);

	tenants.forEach((tenant) => {
		for (let i = 0; i < noOfRequestsPerOrganizations; i++) {
			let tenantPolicy = faker.random.arrayElement(policies);
			let employees = tenantEmployeeMap.get(tenant);
			let specificEmployees = employees
				.sort(() => Math.random() - Math.random())
				.slice(0, 3);

			const requestApproval = new RequestApproval();
			requestApproval.name = faker.random.arrayElement(approvalTypes);
			requestApproval.status = faker.random.number({ min: 1, max: 3 });

			// requestApproval.approvalPolicyId = tenantPolicy.id;
			requestApproval.approvalPolicy = tenantPolicy;
			requestApproval.type = faker.random.number({ min: 1, max: 3 });
			requestApproval.min_count = faker.random.number({
				min: 1,
				max: 100
			});
			requestApproval.createdBy = faker.random.arrayElement(
				specificEmployees
			).id;

			const requestApprovalEmployees: RequestApprovalEmployee[] = [];
			specificEmployees.forEach((employee) => {
				const raEmployees = new RequestApprovalEmployee();
				raEmployees.employeeId = employee.id;
				raEmployees.employee = employee;
				raEmployees.status = requestApproval.status;
				requestApprovalEmployees.push(raEmployees);
			});

			requestApproval.employeeApprovals = requestApprovalEmployees;
			requestApprovals.push(requestApproval);
		}
	});

	await connection
		.createQueryBuilder()
		.insert()
		.into(RequestApproval)
		.values(requestApprovals)
		.execute();
};
