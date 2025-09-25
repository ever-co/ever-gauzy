import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivepiecesIntegration } from '../activepieces-integration.entity';

@Injectable()
export class TypeOrmActivepiecesIntegrationRepository extends Repository<ActivepiecesIntegration> {
	constructor(
		@InjectRepository(ActivepiecesIntegration) readonly repository: Repository<ActivepiecesIntegration>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
