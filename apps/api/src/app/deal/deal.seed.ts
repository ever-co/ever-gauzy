import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee, Organization } from '@gauzy/models';
import { Deal } from './deal.entity';
import * as faker from 'faker';
import { Pipeline } from '../pipeline/pipeline.entity';
import { PipelineStage } from '../pipeline-stage/pipeline-stage.entity';

export const createRandomDeal = async (
  connection: Connection,
  tenants: Tenant[],
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  tenantOrganizationsMap: Map<Tenant, Organization[]>
  ): Promise<Deal[]> => {
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

    const deals: Deal[] = [];

    for (const tenant of tenants) {
      const tenantEmployees = tenantEmployeeMap.get(tenant);
      const tenantOrgs = tenantOrganizationsMap.get(tenant);

      for (const tenantEmployee of tenantEmployees) {
        for (const tenantOrg of tenantOrgs) {
          const pipelines = await connection.manager.find(Pipeline, {
            where: [{ organization: tenantOrg }]
          });
          for (const pipeline of pipelines) {
            const pipelineStages = await connection.manager.find(PipelineStage, {
              where: [{ pipeline: pipeline }]
            });
            for (const pipelineStage of pipelineStages) {
              const deal = new Deal();

              deal.createdBy = tenantEmployee.user;
              deal.stage = pipelineStage;
              deal.title = faker.name.jobTitle();
              deal.createdByUserId = tenantEmployee.user.id;
              deal.stageId = pipelineStage.id;

              deals.push(deal);
            }
          }
        }
      }
    }

    await connection.manager.save(deals);
  }
;
