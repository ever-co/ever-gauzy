import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Invoice])],
	controllers: [InvoiceController],
	providers: [InvoiceService],
	exports: [InvoiceService]
})
export class InvoiceModule {}
