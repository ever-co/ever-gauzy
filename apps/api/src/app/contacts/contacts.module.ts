import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contacts } from './contacts.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Contacts,
		]),
		CqrsModule
	],
	controllers: [ContactsController],
	providers: [
		ContactsService,
		...CommandHandlers
	],
	exports: [ContactsService]

})
export class ContactModule {}
