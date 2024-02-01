import { Repository } from 'typeorm';
import { Equipment } from '../equipment.entity';

export class TypeOrmEquipmentRepository extends Repository<Equipment> { }