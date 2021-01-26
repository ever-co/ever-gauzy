import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './contact.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([Contact]), CqrsModule, TenantModule],
	controllers: [ContactController],
	providers: [ContactService, ...CommandHandlers],
	exports: [ContactService]
})
export class ContactModule {}
