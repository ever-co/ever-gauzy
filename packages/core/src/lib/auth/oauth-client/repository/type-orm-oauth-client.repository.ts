/**
 * TypeORM repository for the multi-app OAuth client registry.
 *
 * Mirrors the shape of `TypeOrmTokenRepository` so the dual-ORM service
 * pipeline (`TenantAwareCrudService`) can pick it up without any glue.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthClient } from '../oauth-client.entity';

@Injectable()
export class TypeOrmOAuthClientRepository extends Repository<OAuthClient> {
	constructor(@InjectRepository(OAuthClient) readonly repository: Repository<OAuthClient>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
