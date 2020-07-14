import { Connection } from 'typeorm';
import { Equipment } from '../equipment/equipment.entity';
import { EquipmentSharing } from './equipment-sharing.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { addDays } from "date-fns";
import { Employee, EquipmentSharingStatusEnum } from '@gauzy/models';
import { OrganizationTeam } from '../organization-team/organization-team.entity';

export const createRandomEquipmentSharing = async (
  connection: Connection,
  tenants: Tenant[],
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  noOfEquipmentSharingPerTenant: number

): Promise<EquipmentSharing[]> => {
  let equipmentSharings: EquipmentSharing[] = [];
  const teams = await connection
    .getRepository(OrganizationTeam)
    .createQueryBuilder()
    .getMany();

  for (const tenant of tenants) {
    const equipments = await connection.manager.find(Equipment, { where: [{ tenant: tenant }] });
    const employees = tenantEmployeeMap.get(tenant);
    for (let i = 0; i < noOfEquipmentSharingPerTenant; i++) {
      let sharing = new EquipmentSharing();
       sharing.equipment = faker.random.arrayElement(equipments);
       sharing.equipmentId = sharing.equipment.id;
       sharing.shareRequestDay = faker.date.recent(30);
       sharing.shareStartDay = faker.date.future(0.5);
       sharing.shareEndDay = addDays(sharing.shareStartDay, faker.random.number(15));
       sharing.status = faker.random.arrayElement(Object.values(EquipmentSharingStatusEnum));
       // sharing.teams =[faker.random.arrayElement(teams)];
      sharing.employees=[faker.random.arrayElement(employees)];
      equipmentSharings.push(sharing);
    }
  }
  return await connection.manager.save(equipmentSharings);
};
