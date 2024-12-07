import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentSharingPolicy } from '../equipment-sharing-policy.entity';

@Injectable()
export class TypeOrmEquipmentSharingPolicyRepository extends Repository<EquipmentSharingPolicy> {
    constructor(@InjectRepository(EquipmentSharingPolicy) readonly repository: Repository<EquipmentSharingPolicy>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
