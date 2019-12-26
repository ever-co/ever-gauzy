import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { SharedModule } from '../shared';
import { OrganizationProjects } from '../organization-projects';

@Module({
	imports: [
		TypeOrmModule.forFeature([Invite, OrganizationProjects]),
		SharedModule
	],
	controllers: [InviteController],
	providers: [InviteService],
	exports: [InviteService]
})
export class InviteModule {}
