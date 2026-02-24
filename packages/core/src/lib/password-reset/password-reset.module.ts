import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { PasswordReset } from './password-reset.entity';
import { PasswordResetService } from './password-reset.service';
import { TypeOrmPasswordResetRepository } from './repository/type-orm-password-reset.repository';
import { MikroOrmPasswordResetRepository } from './repository/mikro-orm-password-reset.repository';

@Module({
	imports: [TypeOrmModule.forFeature([PasswordReset]), MikroOrmModule.forFeature([PasswordReset])],
	providers: [
		PasswordResetService,
		TypeOrmPasswordResetRepository,
		MikroOrmPasswordResetRepository,
		...CommandHandlers
	],
	exports: [PasswordResetService, TypeOrmPasswordResetRepository, MikroOrmPasswordResetRepository]
})
export class PasswordResetModule {}
