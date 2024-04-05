import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentSharing } from '../equipment-sharing.entity';

@Injectable()
export class TypeOrmEquipmentSharingRepository extends Repository<EquipmentSharing> {
    constructor(@InjectRepository(EquipmentSharing) readonly repository: Repository<EquipmentSharing>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
