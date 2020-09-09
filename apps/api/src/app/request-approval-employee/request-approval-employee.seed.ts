import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee, Organization} from '@gauzy/models';
import { RequestApprovalEmployee } from './request-approval-employee.entity';
import * as faker from 'faker';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';

export const createRandomRequestApprovalEmployee = async (
  connection: Connection,
  tenants: Tenant[],
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  tenantOrganizationsMap: Map<Tenant, Organization[]>
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

  const requestApprovalEmployees: RequestApprovalEmployee[] = [];

  for (const tenant of tenants) {
    const tenantOrgs = tenantOrganizationsMap.get(tenant);
    const tenantEmployees = tenantEmployeeMap.get(tenant);

    for (const tenantEmployee of tenantEmployees) {
      for (const tenantOrg of tenantOrgs) {

        const approvalPolicies = await connection.manager.find(ApprovalPolicy, {
          where: [{ organization: tenantOrg }]
        });
        for (const approvalPolicy of approvalPolicies) {

          const requestApprovals = await connection.manager.find(RequestApproval, {
            where: [{ approvalPolicy: approvalPolicy }]
          });
          for (const requestApproval of requestApprovals) {
            const requestApprovalEmployee = new RequestApprovalEmployee();

            requestApprovalEmployee.requestApprovalId = requestApproval.id;
            requestApprovalEmployee.requestApproval = requestApproval;
            requestApprovalEmployee.employeeId = tenantEmployee.id;
            requestApprovalEmployee.employee = tenantEmployee;
            requestApprovalEmployee.status = faker.random.number(99);

            requestApprovalEmployees.push(requestApprovalEmployee);
          }
        }
      }
    }
  }

  await connection.manager.save(requestApprovalEmployees);
};
