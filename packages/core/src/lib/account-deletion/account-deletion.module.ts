import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module';
import { EmailSendModule } from '../email-send/email-send.module';
import { AccountDeletionRequest } from './account-deletion-request.entity';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';
import { MikroOrmAccountDeletionRequestRepository, TypeOrmAccountDeletionRequestRepository } from './repository';

/**
 * Self-service account deletion through an emailed link (`/account-deletion/*`).
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([AccountDeletionRequest]),
		MikroOrmModule.forFeature([AccountDeletionRequest]),
		EmailSendModule,
		// For `AuthenticatedUserCache`: a deleted user's cached sign-in context is dropped at once.
		AuthModule
	],
	controllers: [AccountDeletionController],
	providers: [AccountDeletionService, TypeOrmAccountDeletionRequestRepository, MikroOrmAccountDeletionRequestRepository],
	exports: [AccountDeletionService]
})
export class AccountDeletionModule {}
