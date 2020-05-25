import { AttributeValueController } from './attribute-value.controller';
import { AttributeValueService } from './attribute-value.service';
import { AttributeValue } from './attribute-value.entity';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';



@Module({
  imports: [ TypeOrmModule.forFeature([ AttributeValue ] ), AuthModule ],
  controllers: [ AttributeValueController ],
  providers: [ AttributeValueService ],
  exports: [ AttributeValueService ],
})
export class AttributeValueModule
{
}
