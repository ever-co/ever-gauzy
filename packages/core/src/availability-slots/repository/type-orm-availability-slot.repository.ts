import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilitySlot } from '../availability-slots.entity';

@Injectable()
export class TypeOrmAvailabilitySlotRepository extends Repository<AvailabilitySlot> {
    constructor(@InjectRepository(AvailabilitySlot) readonly repository: Repository<AvailabilitySlot>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
