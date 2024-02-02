import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			CustomSmtp
		]),
		MikroOrmModule.forFeature([
			CustomSmtp
		])
	],
	providers: [CustomSmtpService],
	exports: [
		TypeOrmModule,
		MikroOrmModule,
		CustomSmtpService
	]
})
export class CustomSmtpModule { }
