import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from '../role/role.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { AuthModule } from '../auth/auth.module';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { CandidateTechnologiesController } from './candidate-technologies.controller';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateTechnologies, User]),
		RoleModule,
		RolePermissionsModule,
		AuthModule,
		CqrsModule
	],
	providers: [CandidateTechnologiesService, UserService, ...CommandHandlers],
	controllers: [CandidateTechnologiesController],
	exports: [CandidateTechnologiesService]
})
export class CandidateTechnologiesModule {}
