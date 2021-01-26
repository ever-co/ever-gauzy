import { Module } from '@nestjs/common';
import { CandidateSourceService } from './candidate-source.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateSource } from './candidate-source.entity';
import { CandidateSourceController } from './candidate-source.controller';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateSource]),
		UserModule,
		TenantModule
	],
	providers: [CandidateSourceService],
	controllers: [CandidateSourceController],
	exports: [CandidateSourceService]
})
export class CandidateSourceModule {}
