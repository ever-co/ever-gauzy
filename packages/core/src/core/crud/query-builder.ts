import { Brackets, FindOperator, ObjectLiteral, SelectQueryBuilder, WhereExpression } from "typeorm";

export const filterQuery = <T>(
    qb: SelectQueryBuilder<T>, 
    wheres: ObjectLiteral
) => {
    qb.andWhere(new Brackets((bck: WhereExpression) => { 
        const args = Object.entries(wheres);
        args.forEach((arg) => {
            const [column, value] = arg;

            // query using find operator
            if (value instanceof FindOperator) {
                bck.andWhere(new Brackets((bck: WhereExpression) => { bck.where({ [column]: value }); } ));
            } else if (value instanceof Object) {
                objectQueryMapper(bck, value, column);
            } else if (value instanceof Array) {
                bck.andWhere(`"${qb.alias}"."${column}" IN (:...${column})`, { 
                    [column]: value 
                });
            } else {
                bck.andWhere(`"${qb.alias}"."${column}" = :${column}`, { 
                    [column]: value 
                });
            }
        })
    }));
    return qb;
}

export const objectQueryMapper = (
    query: WhereExpression, 
    value: ObjectLiteral,
    alias: string
) => {
    if (value instanceof Object) {
        query.andWhere(new Brackets((bck: WhereExpression) => { 
             // relational tables query
            for (let [column, entry] of Object.entries(value)) {
                if (entry instanceof FindOperator) {
                    const operator = entry;
                    const { type, value } = operator;
                    switch (type) {
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
