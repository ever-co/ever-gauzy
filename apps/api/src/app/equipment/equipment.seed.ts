import { Connection } from 'typeorm';
import { Equipment } from './equipment.entity';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { CurrenciesEnum } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';

export const createDefaultEquipments = async (
  connection: Connection,
  tenant: Tenant
): Promise<Equipment> => {
  const tags = await connection
    .getRepository(Tag)
    .createQueryBuilder()
    .getMany();

  let equipment = new Equipment();
  equipment.name = 'Fiat Freemont';
  equipment.type = 'Car';
  equipment.serialNumber = 'CB0950AT';
  equipment.manufacturedYear = 2015;
  equipment.initialCost = 40000;
  equipment.currency = CurrenciesEnum.BGN;
  equipment.maxSharePeriod = 7;
  equipment.tags = [faker.random.arrayElement(tags)];
  equipment.tenant = tenant;
  equipment.autoApproveShare = true;

  return await connection.manager.save(equipment);

};


export const createRandomEquipments = async (
  connection: Connection,
  tenants: Tenant[],
  noOfEquipmentsPerTenant: number
): Promise<Equipment[]> => {
  let equipments: Equipment[] = [];
  const tags = await connection
    .getRepository(Tag)
    .createQueryBuilder()
    .getMany();

  let dummyData =
    [{
      'key': 'Car',
      'value': ['Audi A6', 'Audi A8', 'Audi Q8', 'BMW X1', 'BMW X5', 'Maruti Dzire'
        , 'Kia Telluride', 'Chevrolet Corvette', 'Jeep Gladiator', 'Hyundai Palisade'
        , 'Toyota GR Supra', 'Subaru Outback', 'Ford Explorer']
    },
      {
        'key': 'Laptop',
        'value': ['Apple MacBook Pro 16-inch', 'Lenovo ThinkPad E590 Notebook', 'Dell XPS15',
          'Acer Aspire E15', 'Microsoft Surface Pro (Intel Core i7)', 'ASUS P-Series P2440UQ-XS71'
          , 'HP Notebook 15-ay011nr', 'Apple 13″ MacBook Air', 'Asus VivoBook M580VD-EB54',
          'Lenovo 320-15'
          , 'Dell Alienware', 'HP Spectre x360', 'AORUS 15-X9-RT4BD 15']
      },
      {
        'key': 'Monitor',
        'value': ['Dell P2720DC', ' Acer Predator XB272', 'Samsung 27″ SF354', 'Dell Ultrasharp U2720Q', 'LG 34WK95U', 'Samsung CF791'
          , 'BenQ EX3203R']
      },
      {
        'key': 'Printer',
        'value': ['HP DeskJet Ink Advantage', 'HP DeskJet 4535', 'Canon Pixma MG2577s', 'HP LaserJet M1005', ' Samsung SCX-3401', 'Epson L361 '
          , 'Brother DCP-T300 ', 'Xerox WorkCentre 6515 printer', 'Canon Pixma TR8550 printer', 'HP LaserJet Pro MFP M227fdw printer']
      },
      {
        'key': 'Camera',
        'value': ['Nikon Z6', 'Fujifilm X-T4', 'Sony A7 III ', 'Nikon Z50 ', 'Sony A6100', 'Olympus OM-D E-M5 Mark III'
          , 'Sony ZV-1']
      },
      {
        'key': 'Mobile',
        'value': ['Iphone 7', 'Iphone 8', 'Iphone 11 pro', 'Samsung s10', 'Samsumg s11', 'Blackberry'
          , 'Nokia']
      }
    ];

  tenants.forEach(tenant => {
    for (let i = 0; i < noOfEquipmentsPerTenant; i++) {
      let equipment = new Equipment();
      let randomElement = faker.random.arrayElement(dummyData);
      equipment.type = randomElement.key;
      equipment.name = faker.random.arrayElement(randomElement.value);
      equipment.serialNumber = faker.random.uuid();
      equipment.manufacturedYear = faker.random.number({min:2000,max:2020});
      equipment.initialCost = faker.random.number({min:10000,max:50000});
      equipment.currency = faker.random.arrayElement(Object.values(CurrenciesEnum));
      equipment.maxSharePeriod = faker.random.number({min:1,max:15});
      equipment.tags = [faker.random.arrayElement(tags)];
      equipment.tenant = tenant;
      equipment.autoApproveShare = faker.random.boolean();
      equipments.push(equipment);
    }
  });

  return await connection.manager.save(equipments);

};
