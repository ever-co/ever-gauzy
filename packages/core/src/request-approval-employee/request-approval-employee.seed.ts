import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@ever-co/faker';
import { RequestApprovalEmployee } from './request-approval-employee.entity';
import { ApprovalPolicy, RequestApproval } from './../core/entities/internal';

export const createRandomRequestApprovalEmployee = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<RequestApprovalEmployee[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Request Approval Employee  will not be created'
		);
		return;
	}
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, Request Approval Employee  will not be created'
		);
		return;
	}

	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const tenantEmployee of tenantEmployees) {
			for (const tenantOrg of tenantOrgs) {
				const { id: organizationId } = tenantOrg;
				const requestApprovalEmployees: RequestApprovalEmployee[] = [];
				const approvalPolicies = await dataSource.manager.find(
					ApprovalPolicy,
					{ where: { tenantId, organizationId } }
				);
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
						requestApprovalEmployee.status = faker.datatype.number(
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
