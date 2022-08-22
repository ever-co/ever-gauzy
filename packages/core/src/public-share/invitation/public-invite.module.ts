import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from './../../core/entities/internal';
import { PublicInviteController } from './public-invite.controller';
import { PublicInviteService } from './public-invite.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([
			Invite
		]),
	],
	controllers: [
		PublicInviteController
	],
	providers: [
		...QueryHandlers,
		PublicInviteService,
	],
	exports: []
})
export class PublicInviteModule {}