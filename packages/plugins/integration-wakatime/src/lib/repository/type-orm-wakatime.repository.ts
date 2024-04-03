import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wakatime } from '../wakatime.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmWakatimeRepository extends Repository<Wakatime> {
	constructor(@InjectRepository(Wakatime) readonly repository: Repository<Wakatime>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
