import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStore } from 'core';



@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/product-stores', module: ProductStoreModule }
		]),
		TypeOrmModule.forFeature([ProductStore]),
	],
	controllers: [],
	providers: []
})
export class ProductStoreModule {}