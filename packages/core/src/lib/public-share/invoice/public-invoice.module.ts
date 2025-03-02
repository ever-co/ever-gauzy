import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { Invoice } from './../../core/entities/internal';
import { PublicInvoiceController } from './public-invoice.controller';
import { PublicInvoiceService } from './public-invoice.service';

@Module({
	imports: [CqrsModule, TypeOrmModule.forFeature([Invoice]), MikroOrmModule.forFeature([Invoice])],
	controllers: [PublicInvoiceController],
	providers: [PublicInvoiceService, ...QueryHandlers, ...CommandHandlers]
})
export class PublicInvoiceModule {}
