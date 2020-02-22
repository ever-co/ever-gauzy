import { Tenant } from './tenant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
	imports: [TypeOrmModule.forFeature([Tenant])],
	controllers: [TenantController],
	providers: [TenantService],
	exports: [TenantService]
})
export class TenantModule {}
