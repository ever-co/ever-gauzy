import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickWave } from '../pick-wave.entity';

@Injectable()
export class TypeOrmPickWaveRepository extends Repository<PickWave> {
	constructor(@InjectRepository(PickWave) readonly repository: Repository<PickWave>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
