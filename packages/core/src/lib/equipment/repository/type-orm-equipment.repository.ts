import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from '../equipment.entity';

@Injectable()
export class TypeOrmEquipmentRepository extends Repository<Equipment> {
    constructor(@InjectRepository(Equipment) readonly repository: Repository<Equipment>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
