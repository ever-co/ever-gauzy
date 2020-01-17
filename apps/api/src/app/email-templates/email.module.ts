import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailTemplate } from './email.entity';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplate])],
	providers: [EmailService],
	exports: [TypeOrmModule]
})
export class EmailModule {}
