import { AttributeDefinitionController } from './attribute-definition.controller';
import { AttributeDefinitionService } from './attribute-definition.service';
import { AttributeDefinition } from './attribute-definition.entity';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';



@Module({
  imports: [ TypeOrmModule.forFeature([ AttributeDefinition ] ), AuthModule ],
  controllers: [ AttributeDefinitionController ],
  providers: [ AttributeDefinitionService ],
  exports: [ AttributeDefinitionService ],
})
export class AttributeDefinitionModule
{
}
