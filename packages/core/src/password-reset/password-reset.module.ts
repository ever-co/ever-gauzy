import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { PasswordReset } from './password-reset.entity';
import { PasswordResetService } from './password-reset.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		TypeOrmModule.forFeature([PasswordReset]),
		MikroOrmModule.forFeature([PasswordReset])
	],
	providers: [
		PasswordResetService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		PasswordResetService
	]
})
export class PasswordResetModule { }
