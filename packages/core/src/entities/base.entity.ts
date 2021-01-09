import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export abstract class Model {
  constructor(input?: any) {
    if (input) {
      for (const [key, value] of Object.entries(input)) {
        (this as any)[key] = value;
      }
    }
  }
}
export abstract class BaseEntity extends Model {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;
}
