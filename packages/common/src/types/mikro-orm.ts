import { Entity, ManyToOne, OneToMany, OneToOne, ManyToMany, Enum } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";

export const MikroEntity = Entity;
export const MikroInjectRepository = InjectRepository;
export const MikroManyToOne = ManyToOne;
export const MikroOneToMany = OneToMany;
export const MikroOneToOne = OneToOne;
export const MikroManyToMany = ManyToMany;
export const MikroEnum = Enum;
