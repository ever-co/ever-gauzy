import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity()
export class Role extends BaseEntity {
  @Column()
  code: string;

  @Column()
  description: string;
}
