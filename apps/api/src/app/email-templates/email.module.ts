import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email.entity';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplate])],
	providers: [EmailService],
	exports: [EmailService]
})
export class EmailModule {}
