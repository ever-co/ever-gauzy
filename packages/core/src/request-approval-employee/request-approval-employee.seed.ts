import { Connection } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import * as faker from 'faker';
import { RequestApprovalEmployee } from './request-approval-employee.entity';
import { ApprovalPolicy, RequestApproval } from './../core/entities/internal';

export const createRandomRequestApprovalEmployee = async (
	connection: Connection,
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
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const tenantEmployee of tenantEmployees) {
			for (const tenantOrg of tenantOrgs) {
				const requestApprovalEmployees: RequestApprovalEmployee[] = [];
				const approvalPolicies = await connection.manager.find(
					ApprovalPolicy,
					{ where: { organization: tenantOrg } }
				);
				for (const approvalPolicy of approvalPolicies) {
					const requestApprovals = await connection.manager.find(
						RequestApproval,
						{
							where: { approvalPolicy: approvalPolicy }
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
				await connection.manager.save(requestApprovalEmployees);
			}
		}
	}
};
