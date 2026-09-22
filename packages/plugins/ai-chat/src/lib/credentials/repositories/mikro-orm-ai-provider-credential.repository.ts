import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { AiProviderCredential } from '../ai-provider-credential.entity';

export class MikroOrmAiProviderCredentialRepository extends MikroOrmBaseEntityRepository<AiProviderCredential> {}
