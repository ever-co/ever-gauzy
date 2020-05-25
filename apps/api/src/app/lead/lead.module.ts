import { LeadController } from './lead.controller';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadService } from './lead.service';
import { Module } from '@nestjs/common';
import { Lead } from './lead.entity';



@Module({
  imports: [ TypeOrmModule.forFeature([ Lead ] ), AuthModule ],
  controllers: [ LeadController ],
  providers: [ LeadService ],
  exports: [ LeadService ],
})
export class LeadModule
{
}
