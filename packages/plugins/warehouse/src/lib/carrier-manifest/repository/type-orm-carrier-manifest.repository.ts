import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarrierManifest } from '../carrier-manifest.entity';

@Injectable()
export class TypeOrmCarrierManifestRepository extends Repository<CarrierManifest> {
	constructor(@InjectRepository(CarrierManifest) readonly repository: Repository<CarrierManifest>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
