import { Module } from '@nestjs/common';
import { UUIDValidationPipe } from './pipes/uuid-validation.pipe';

@Module({
  imports: [],
  providers: [UUIDValidationPipe],
  exports: [UUIDValidationPipe],
})
export class SharedModule { }
