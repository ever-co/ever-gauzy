import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';

@Module({
	imports: [TypeOrmModule.forFeature([User, Invoice])],
	controllers: [InvoiceController],
	providers: [InvoiceService, UserService],
	exports: [InvoiceService, UserService]
})
export class InvoiceModule {}
