import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { AuthModule } from '../auth/auth.module';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import { CandidatePersonalQualitiesController } from './candidate-personal-qualities.controller';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/candidate-personal-qualities',
				module: CandidatePersonalQualitiesModule
			}
		]),
		TypeOrmModule.forFeature([CandidatePersonalQualities, User]),
		UserModule,
		RoleModule,
		RolePermissionsModule,
		AuthModule,
		CqrsModule,
		TenantModule
	],
	providers: [
		CandidatePersonalQualitiesService,
		UserService,
		...CommandHandlers
	],
	controllers: [CandidatePersonalQualitiesController],
	exports: [CandidatePersonalQualitiesService]
})
export class CandidatePersonalQualitiesModule {}
