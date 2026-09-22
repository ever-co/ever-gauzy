import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProviderCredential } from '../ai-provider-credential.entity';

@Injectable()
export class TypeOrmAiProviderCredentialRepository extends Repository<AiProviderCredential> {
	constructor(@InjectRepository(AiProviderCredential) readonly repository: Repository<AiProviderCredential>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
