import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './contact.entity';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
	imports: [TypeOrmModule.forFeature([Contact])],
	controllers: [ContactController],
	providers: [ContactService],
	exports: [ContactService]
})
export class ContactModule {}
