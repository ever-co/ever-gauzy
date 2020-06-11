import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { AuthModule } from '../auth/auth.module';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { CandidateTechnologiesController } from './candidate-technologies.controller';
import { CandidateTechnologiesService } from './candidate-technologies.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateTechnologies]),
		UserModule,
		RoleModule,
		RolePermissionsModule,
		AuthModule
	],
	providers: [CandidateTechnologiesService],
	controllers: [CandidateTechnologiesController],
	exports: [CandidateTechnologiesService]
})
export class CandidateTechnologiesModule {}
