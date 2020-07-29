import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee, Organization } from '@gauzy/models';
import { RequestApprovalTeam } from './request-approval-team.entity';
import * as faker from 'faker';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';

export const createRandomRequestApprovalTeam = async (
  connection: Connection,
  tenants: Tenant[],
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<RequestApprovalTeam[]> => {
  if (!tenantOrganizationsMap) {
    console.warn(
      'Warning: tenantOrganizationsMap not found, Request Approval Team  will not be created'
    );
    return;
  }
  if (!tenantEmployeeMap) {
    console.warn(
      'Warning: tenantEmployeeMap not found, Request Approval Team  will not be created'
    );
    return;
  }

  const requestApprovalEmployees: RequestApprovalTeam[] = [];

  for (const tenant of tenants) {
    const tenantOrgs = tenantOrganizationsMap.get(tenant);
    const tenantEmployees = tenantEmployeeMap.get(tenant);

    for (const tenantEmployee of tenantEmployees) {
      for (const tenantOrg of tenantOrgs) {
        const approvalPolicies = await connection.manager.find(ApprovalPolicy, {
          where: [{ organization: tenantOrg }]
        });

        const organizationTeams = await connection.manager.find(OrganizationTeam, {
          where: [{ organizationId: tenantOrg.id }]
        });

        for (const approvalPolicy of approvalPolicies) {

          const requestApprovals = await connection.manager.find(RequestApproval, {
            where: [{ approvalPolicy: approvalPolicy }]
          });
          for (const requestApproval of requestApprovals) {
            for (const organizationTeam of organizationTeams) {

              const requestApprovalEmployee = new RequestApprovalTeam();

              requestApprovalEmployee.requestApprovalId = requestApproval.id;
              requestApprovalEmployee.requestApproval = requestApproval;
              requestApprovalEmployee.teamId = organizationTeam.id;
              requestApprovalEmployee.team = organizationTeam;
              requestApprovalEmployee.status = faker.random.number(3);

              requestApprovalEmployees.push(requestApprovalEmployee);
            }
          }
        }
      }
    }
  }

  await connection.manager.save(requestApprovalEmployees);
};
