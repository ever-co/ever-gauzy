import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Merchant } from './merchant.entity';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [TypeOrmModule.forFeature([Merchant]), MikroOrmModule.forFeature([Merchant]), RolePermissionModule],
	controllers: [MerchantController],
	providers: [MerchantService],
	exports: [MerchantService]
})
export class MerchantModule {}
