import { Entity, ManyToOne, OneToMany, OneToOne, ManyToMany } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

export const TypeEntity = Entity;
export const TypeInjectRepository = InjectRepository;
export const TypeManyToOne = ManyToOne;
export const TypeOneToMany = OneToMany;
export const TypeOneToOne = OneToOne;
export const TypeManyToMany = ManyToMany;
