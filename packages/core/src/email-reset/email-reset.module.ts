import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { EmailReset } from './email-reset.entity';
import { EmailResetService } from './email-reset.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmailReset])
  	],
  	providers: [EmailResetService, ...CommandHandlers],
  	exports: [TypeOrmModule, EmailResetService],
})
export class EmailResetModule {}
