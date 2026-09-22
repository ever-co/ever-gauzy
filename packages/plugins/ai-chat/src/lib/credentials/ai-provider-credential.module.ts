import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '@gauzy/core';
import { AiProviderCredential } from './ai-provider-credential.entity';
import { AiProviderCredentialController } from './ai-provider-credential.controller';
import { AiProviderCredentialEncryptionService } from './ai-provider-credential-encryption.service';
import { AiProviderCredentialService } from './ai-provider-credential.service';
import { TypeOrmAiProviderCredentialRepository } from './repositories/type-orm-ai-provider-credential.repository';

/**
 * AiProviderCredentialModule
 *
 * Storage + management of per-tenant BYOK AI provider credentials
 * (API keys encrypted at rest — see {@link AiProviderCredentialEncryptionService}).
 * Exports {@link AiProviderCredentialService} for the chat engine.
 */
@Module({
	controllers: [AiProviderCredentialController],
	imports: [
		TypeOrmModule.forFeature([AiProviderCredential]),
		MikroOrmModule.forFeature([AiProviderCredential]),
		RolePermissionModule
	],
	providers: [AiProviderCredentialService, AiProviderCredentialEncryptionService, TypeOrmAiProviderCredentialRepository],
	exports: [AiProviderCredentialService]
})
export class AiProviderCredentialModule {}
