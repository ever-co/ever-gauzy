import { LeadAttributeController } from './lead-attribute.controller';
import { LeadAttributeService } from './lead-attribute.service';
import { LeadAttribute } from './lead-attribute.entity';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';



@Module({
  imports: [ TypeOrmModule.forFeature([ LeadAttribute ] ), AuthModule ],
  controllers: [ LeadAttributeController ],
  providers: [ LeadAttributeService ],
  exports: [ LeadAttributeService ],
})
export class LeadAttributeModule
{
}
