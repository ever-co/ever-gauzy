import { Entity as MikroOrmEntity } from "@mikro-orm/core";
import { Entity as TypeOrmEntity } from 'typeorm';

export function Entity(options) {
    return function (target: any) {
        MikroOrmEntity(options)(target);
        TypeOrmEntity(options)(target);
    }
}
