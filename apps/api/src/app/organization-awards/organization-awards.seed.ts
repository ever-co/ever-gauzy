import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import {OrganizationAwards} from './organization-awards.entity';
import * as faker from 'faker';

export const createRandomAwards = async (
  connection: Connection,
  tenants: Tenant[],
  tenantOrganizationsMap: Map<Tenant, Organization[]>,
 ): Promise<OrganizationAwards[]> => {
  let awards :OrganizationAwards[] = [];
  for(const tenant of tenants){
    let organizations = tenantOrganizationsMap.get(tenant);
    let awardsData =["Best Product", "Best Revenue", "Best Idea","Rising Star Product"];

    for(const org of organizations){
      for(let i=0;i<awardsData.length;i++){
        let award = new OrganizationAwards();
        award.name=awardsData[i];
        award.year = faker.random.number({min:1990,max:2020}).toString();
        award.organization = org;
        awards.push(award);
      }
    }
  }
  return await connection.manager.save(awards);
};
