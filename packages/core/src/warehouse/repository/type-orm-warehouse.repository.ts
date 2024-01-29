import { Repository } from 'typeorm';
import { Warehouse } from '../warehouse.entity';

export class TypeOrmWarehouseRepository extends Repository<Warehouse> { }