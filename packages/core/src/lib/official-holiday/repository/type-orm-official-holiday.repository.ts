import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfficialHoliday } from '../official-holiday.entity';

@Injectable()
export class TypeOrmOfficialHolidayRepository extends Repository<OfficialHoliday> {
	constructor(@InjectRepository(OfficialHoliday) readonly repository: Repository<OfficialHoliday>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
