import { PrimaryGeneratedColumn } from 'typeorm';
import { ApiModelPropertyOptional } from '@nestjs/swagger';

export abstract class Base {
  @ApiModelPropertyOptional({ type: String })
  @PrimaryGeneratedColumn('uuid')
  id?: string;
}
