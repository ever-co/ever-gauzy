import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { RequestApprovalEmployee } from './request-approval-employee.entity';
import { ApprovalPolicy, RequestApproval } from './../core/entities/internal';

export const createRandomRequestApprovalEmployee = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<RequestApprovalEmployee[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Request Approval Employee  will not be created'
		);
		return;
	}
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Request Approval Employee  will not be created'
		);
		return;
	}

	for await (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const { id: organizationId } = tenantOrg;
			const approvalPolicies = await dataSource.manager.find(
				ApprovalPolicy,
				{ where: { tenantId, organizationId } }
			);
			const tenantEmployees = organizationEmployeesMap.get(tenantOrg);
			for (const tenantEmployee of tenantEmployees) {
				const requestApprovalEmployees: RequestApprovalEmployee[] = [];
				for (const approvalPolicy of approvalPolicies) {
					const requestApprovals = await dataSource.manager.find(
						RequestApproval,
						{
							where: { approvalPolicyId: approvalPolicy.id }
						}
					);
					for (const requestApproval of requestApprovals) {
						const requestApprovalEmployee = new RequestApprovalEmployee();

						requestApprovalEmployee.requestApprovalId =
							requestApproval.id;
						requestApprovalEmployee.requestApproval = requestApproval;
						// requestApprovalEmployee.employeeId = tenantEmployee.id;
						requestApprovalEmployee.employee = tenantEmployee;
						requestApprovalEmployee.status = faker.number.int(
							99
						);
						requestApprovalEmployee.tenant = tenant;
						requestApprovalEmployee.organization = tenantOrg;

						requestApprovalEmployees.push(requestApprovalEmployee);
					}
				}
				await dataSource.manager.save(requestApprovalEmployees);
			}
		}
	}
};
