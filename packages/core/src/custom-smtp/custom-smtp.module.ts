import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			CustomSmtp
		])
	],
	providers: [CustomSmtpService],
	exports: [TypeOrmModule, CustomSmtpService]
})
export class CustomSmtpModule { }
