import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { AuthModule } from '../auth/auth.module';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import { CandidatePersonalQualitiesController } from './candidate-personal-qualities.controller';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidatePersonalQualities]),
		UserModule,
		RoleModule,
		RolePermissionsModule,
		AuthModule
	],
	providers: [CandidatePersonalQualitiesService],
	controllers: [CandidatePersonalQualitiesController],
	exports: [CandidatePersonalQualitiesService]
})
export class CandidatePersonalQualitiesModule {}
