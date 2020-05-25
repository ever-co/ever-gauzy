import { AttributeValidatorController } from './attribute-validator.controller';
import { AttributeValidatorService } from './attribute-validator.service';
import { AttributeValidator } from './attribute-validator.entity';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';



@Module({
  imports: [ TypeOrmModule.forFeature([ AttributeValidator ] ), AuthModule ],
  controllers: [ AttributeValidatorController ],
  providers: [ AttributeValidatorService ],
  exports: [ AttributeValidatorService ],
})
export class AttributeValidatorModule
{
}
