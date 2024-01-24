import { Entity as MikroOrmEntity } from "@mikro-orm/core";
import { Entity as TypeOrmEntity } from 'typeorm';

export function Entity(options?: any) {
    let mikroOrmOptions = {}
    if (typeof options === 'string') {
        mikroOrmOptions = {
            tableName: options
        }
    } else {
        mikroOrmOptions = options
    }
    return function (target: any) {
        MikroOrmEntity(mikroOrmOptions)(target);
        TypeOrmEntity(options)(target);
    }
}
