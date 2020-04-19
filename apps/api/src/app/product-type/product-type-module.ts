import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductType } from './product-type.entity';
import { Module } from '@nestjs/common';
import { ProductTypeController } from './product-type.controller';
import { ProductTypeService } from './product-type.service';

@Module({
	imports: [TypeOrmModule.forFeature([ProductType])],
	controllers: [ProductTypeController],
	providers: [ProductTypeService]
})
export class ProductTypesModule {}
