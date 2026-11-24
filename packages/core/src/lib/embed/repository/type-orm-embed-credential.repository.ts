import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbedCredential } from '../embed-credential.entity';

@Injectable()
export class TypeOrmEmbedCredentialRepository extends Repository<EmbedCredential> {
	constructor(@InjectRepository(EmbedCredential) readonly repository: Repository<EmbedCredential>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
