import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { RoleModule } from '../role/role.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { AuthModule } from '../auth/auth.module';
import { CandidateTechnologiesController } from './candidate-technologies.controller';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CommandHandlers } from './commands/handlers';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';
import { CandidateTechnologies, User } from './../core/entities/internal';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/candidate-technologies',
				module: CandidateTechnologiesModule
			}
		]),
		TypeOrmModule.forFeature([CandidateTechnologies, User]),
		RoleModule,
		RolePermissionsModule,
		AuthModule,
		CqrsModule,
		TenantModule
	],
	providers: [CandidateTechnologiesService, UserService, ...CommandHandlers],
	controllers: [CandidateTechnologiesController],
	exports: [CandidateTechnologiesService]
})
export class CandidateTechnologiesModule {}
