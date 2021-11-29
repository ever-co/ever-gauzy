import { Brackets, FindOperator, ObjectLiteral, SelectQueryBuilder, WhereExpressionBuilder } from "typeorm";

export const filterQuery = <T>(
    qb: SelectQueryBuilder<T>, 
    wheres: ObjectLiteral
) => {
    qb.andWhere(new Brackets((bck: WhereExpressionBuilder) => { 
        const args = Object.entries(wheres);
        args.forEach((arg) => {
            const [column, entry] = arg;

            // query using find operator
            if (entry instanceof FindOperator) {
                const operator = entry;
                const { type, value } = operator;
                bck.andWhere(
                    new Brackets((bck: WhereExpressionBuilder) => { 
                        switch (type) {
                            case 'between':
                                const [start, end ] = value;
                                bck.andWhere(`"${qb.alias}"."${column}" ${type} '${start}' AND '${end}'`);
                                break;
                            case 'ilike':
                                bck.andWhere(`"${qb.alias}"."${column}" ${type} :${column}`, { 
                                    [column]: value
                                });
                                break;
                            case 'like':
                                bck.andWhere(`LOWER("${qb.alias}"."${column}") ${type} LOWER(:${column})`, { 
                                    [column]: value
                                });
                                break;
                            case 'in':
                                bck.andWhere(`"${qb.alias}"."${column}" ${type} (:...${column})`, { 
                                    [column]: value
                                });
                                break;
                            case 'isNull':
                                bck.andWhere(`"${qb.alias}"."${column}" IS NULL`);
                                break;
                            default: 
                                bck.where({ [column]: value });
                                break;
                        }
                    } 
                ));
            } else if (entry instanceof Object) {
                objectQueryMapper(bck, entry, column);
            } else if (entry instanceof Array) {
                bck.andWhere(`"${qb.alias}"."${column}" IN (:...${column})`, { 
                    [column]: entry 
                });
            } else {
                bck.andWhere(`"${qb.alias}"."${column}" = :${column}`, { 
                    [column]: entry 
                });
            }
        })
    }));
    return qb;
}

export const objectQueryMapper = (
    query: WhereExpressionBuilder, 
    value: ObjectLiteral,
    alias: string
) => {
    if (value instanceof Object) {
        query.andWhere(new Brackets((bck: WhereExpressionBuilder) => { 
             // relational tables query
            for (let [column, entry] of Object.entries(value)) {
                if (entry instanceof FindOperator) {
                    const operator = entry;
                    const { type, value } = operator;
                    switch (type) {
                        case 'between':
                            const [start, end ] = value;
                            bck.andWhere(`"${alias}"."${column}" ${type} '${start}' AND '${end}'`);
                            break;
                        case 'ilike':
                            bck.andWhere(`"${alias}"."${column}" ${type} :${column}`, { 
                                [column]: value
                            });
                            break;
                        case 'in':
                            bck.andWhere(`"${alias}"."${column}" ${type} (:...${column})`, { 
                                [column]: value
                            });
                            break;
                    }
                } else if (entry instanceof Object) {
                    objectQueryMapper(bck, entry, column);
                } else if (value instanceof Array) {
                    bck.andWhere(`"${alias}"."${column}" IN (:...${column})`, { 
                        [column]: value 
                    });
                } else {
                    bck.andWhere(`"${alias}"."${column}" = :${column}`, { 
                        [column]: value 
                    });
                }
            }
        }));
    }
    return query;
}
