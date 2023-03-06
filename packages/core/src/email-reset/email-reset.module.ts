import { Module } from '@nestjs/common';
import { EmailResetService } from './email-reset.service';

@Module({
  providers: [EmailResetService]
})
export class EmailResetModule {}
