import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemController } from './invoice-item.controller';
import { InvoiceItemService } from './invoice-item.service';

@Module({
	imports: [TypeOrmModule.forFeature([InvoiceItem])],
	controllers: [InvoiceItemController],
	providers: [InvoiceItemService],
	exports: [InvoiceItemService]
})
export class InvoicesModule {}
