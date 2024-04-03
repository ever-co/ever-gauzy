import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpCenter } from '../help-center.entity';

@Injectable()
export class TypeOrmHelpCenterRepository extends Repository<HelpCenter> {
	constructor(@InjectRepository(HelpCenter) readonly repository: Repository<HelpCenter>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
