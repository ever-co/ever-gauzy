import { Repository } from 'typeorm';
import { EquipmentSharingPolicy } from '../equipment-sharing-policy.entity';

export class TypeOrmEquipmentSharingPolicyRepository extends Repository<EquipmentSharingPolicy> { }