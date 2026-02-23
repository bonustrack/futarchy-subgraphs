"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNestedResolver = void 0;
exports.queryMulti = queryMulti;
exports.querySingle = querySingle;
const graphql_1 = require("graphql");
const graphql_parse_resolve_info_1 = require("graphql-parse-resolve-info");
const database_1 = require("../utils/database");
const graphql_2 = require("../utils/graphql");
async function queryMulti(parent, args, context, info) {
    const { log, knex } = context;
    const nonNullType = (0, graphql_2.getNonNullType)(info.returnType);
    if (!(0, graphql_1.isListType)(nonNullType))
        throw new Error('unexpected return type');
    const returnType = (0, graphql_2.getNonNullType)(nonNullType.ofType);
    const jsonFields = getJsonFields(returnType);
    const tableName = (0, database_1.getTableName)(returnType.name.toLowerCase());
    const nestedEntitiesMappings = {};
    let query = knex.select(`${tableName}.*`).from(tableName);
    query = (0, database_1.applyQueryFilter)(query, tableName, {
        block: args.block,
        indexer: args.indexer
    });
    const handleWhere = (query, prefix, where, currentType = returnType) => {
        const isFieldList = (fieldName) => {
            const fieldType = (0, graphql_2.getNonNullType)(currentType.getFields()[fieldName].type);
            return (0, graphql_1.isListType)(fieldType);
        };
        Object.entries(where).map((w) => {
            // TODO: we could generate where as objects { name, column, operator, value }
            // so we don't have to cut it there
            if (w[0].endsWith('_not')) {
                const fieldName = w[0].slice(0, -4);
                const isList = isFieldList(fieldName);
                if (isList) {
                    query = query.whereRaw(`NOT :field: @> :value::jsonb OR NOT :field: <@ :value::jsonb`, {
                        field: `${prefix}.${fieldName}`,
                        value: JSON.stringify(w[1])
                    });
                }
                else {
                    query = query.where(`${prefix}.${fieldName}`, '!=', w[1]);
                }
            }
            else if (w[0].endsWith('_gt')) {
                query = query.where(`${prefix}.${w[0].slice(0, -3)}`, '>', w[1]);
            }
            else if (w[0].endsWith('_gte')) {
                query = query.where(`${prefix}.${w[0].slice(0, -4)}`, '>=', w[1]);
            }
            else if (w[0].endsWith('_lt')) {
                query = query.where(`${prefix}.${w[0].slice(0, -3)}`, '<', w[1]);
            }
            else if (w[0].endsWith('_lte')) {
                query = query.where(`${prefix}.${w[0].slice(0, -4)}`, '<=', w[1]);
            }
            else if (w[0].endsWith('_not_contains')) {
                const fieldName = w[0].slice(0, -13);
                const isList = isFieldList(fieldName);
                if (isList) {
                    const arrayBindings = w[1].map(() => '?').join(', ');
                    query = query.whereRaw(`NOT ?? \\?| array[${arrayBindings}]`, [
                        `${prefix}.${fieldName}`,
                        ...w[1]
                    ]);
                }
                else {
                    query = query.not.whereLike(`${prefix}.${fieldName}`, `%${w[1]}%`);
                }
            }
            else if (w[0].endsWith('_not_contains_nocase')) {
                query = query.not.whereILike(`${prefix}.${w[0].slice(0, -20)}`, `%${w[1]}%`);
            }
            else if (w[0].endsWith('_contains')) {
                const fieldName = w[0].slice(0, -9);
                const isList = isFieldList(fieldName);
                if (isList) {
                    const arrayBindings = w[1].map(() => '?').join(', ');
                    query = query.whereRaw(`?? \\?& array[${arrayBindings}]`, [
                        `${prefix}.${fieldName}`,
                        ...w[1]
                    ]);
                }
                else {
                    query = query.whereLike(`${prefix}.${fieldName}`, `%${w[1]}%`);
                }
            }
            else if (w[0].endsWith('_contains_nocase')) {
                query = query.whereILike(`${prefix}.${w[0].slice(0, -16)}`, `%${w[1]}%`);
            }
            else if (w[0].endsWith('_not_in')) {
                query = query.not.whereIn(`${prefix}.${w[0].slice(0, -7)}`, w[1]);
            }
            else if (w[0].endsWith('_in')) {
                query = query.whereIn(`${prefix}.${w[0].slice(0, -3)}`, w[1]);
            }
            else if (typeof w[1] === 'object' && w[0].endsWith('_')) {
                const fieldName = w[0].slice(0, -1);
                const nestedReturnType = (0, graphql_2.getNonNullType)(currentType.getFields()[fieldName].type);
                const nestedTableName = (0, database_1.getTableName)(nestedReturnType.name.toLowerCase());
                
                // Allow deeply nested joins by utilizing the prefix path
                const aliasName = `${prefix}_${nestedTableName}`;
                
                const fields = Object.values(nestedReturnType.getFields())
                    .filter(field => {
                    const baseType = (0, graphql_2.getNonNullType)(field.type);
                    return ((0, graphql_1.isScalarType)(baseType) ||
                        (0, graphql_1.isObjectType)(baseType) ||
                        ((0, graphql_1.isListType)(baseType) && !(0, graphql_2.getDerivedFromDirective)(field)));
                })
                    .map(field => field.name);
                
                // Save the path for deeply nested objects to parse back out
                // We use prefix + fieldName as the key.
                const pathPrefix = prefix === tableName ? fieldName : `${prefix}.${fieldName}`;
                nestedEntitiesMappings[pathPrefix] = {
                    [`${pathPrefix}.id`]: `${aliasName}.id`,
                    ...Object.fromEntries(fields.map(field => [
                        `${pathPrefix}.${field}`,
                        `${aliasName}.${field}`
                    ]))
                };
                
                query = query
                    .columns(nestedEntitiesMappings[pathPrefix])
                    .innerJoin(`${nestedTableName} as ${aliasName}`, `${prefix}.${fieldName}`, '=', `${aliasName}.id`)
                    .whereRaw('?? = ??', [
                    `${tableName}._indexer`,
                    `${aliasName}._indexer`
                ]);
                
                query = (0, database_1.applyQueryFilter)(query, aliasName, {
                    block: args.block,
                    indexer: args.indexer
                });
                
                handleWhere(query, aliasName, w[1], nestedReturnType);
            }
            else {
                const fieldName = w[0];
                const isList = isFieldList(fieldName);
                if (isList) {
                    query = query.whereRaw(`:field: @> :value::jsonb AND :field: <@ :value::jsonb`, {
                        field: `${prefix}.${fieldName}`,
                        value: JSON.stringify(w[1])
                    });
                }
                else {
                    query = query.where(`${prefix}.${fieldName}`, w[1]);
                }
            }
        });
    };
    if (args.where) {
        handleWhere(query, tableName, args.where);
    }
    if (args.orderBy) {
        query = query.orderBy(`${tableName}.${args.orderBy}`, args.orderDirection?.toLowerCase() || 'desc');
    }
    query = (0, database_1.applyDefaultOrder)(query, tableName);
    query = query.limit(args?.first || 1000).offset(args?.skip || 0);
    log.debug({ sql: query.toQuery(), args }, 'executing multi query');
    const result = await query;
    return result.map(item => {
        const nested = Object.fromEntries(Object.entries(nestedEntitiesMappings).map(([fieldName, mapping]) => {
            return [
                fieldName,
                Object.fromEntries(Object.entries(mapping).map(([to, from]) => {
                    const exploded = from.split('.');
                    const key = exploded[exploded.length - 1];
                    return [key, item[to]];
                }))
            ];
        }));
        return {
            ...formatItem(item, jsonFields),
            ...nested,
            _args: {
                block: args.block,
                indexer: args.indexer
            }
        };
    });
}
async function querySingle(parent, args, context, info) {
    const queryFilter = {
        block: parent?._args.block ?? args.block,
        indexer: parent?._args.indexer ?? args.indexer
    };
    const returnType = (0, graphql_2.getNonNullType)(info.returnType);
    const jsonFields = getJsonFields(returnType);
    const parentResolvedValue = parent?.[info.fieldName];
    if (parentResolvedValue === null)
        return null;
    const alreadyResolvedInParent = typeof parentResolvedValue === 'object';
    if (alreadyResolvedInParent) {
        return {
            ...formatItem(parentResolvedValue, jsonFields),
            _args: queryFilter
        };
    }
    const parsed = (0, graphql_parse_resolve_info_1.parseResolveInfo)(info);
    if (parsed && parentResolvedValue) {
        const simplified = (0, graphql_parse_resolve_info_1.simplifyParsedResolveInfoFragmentWithType)(
        // @ts-ignore
        parsed, returnType);
        if (Object.keys(simplified.fields).length === 1 &&
            simplified.fields['id']) {
            return { id: parentResolvedValue, _args: queryFilter };
        }
    }
    const id = parentResolvedValue || args.id;
    const items = await context
        .getLoader(returnType.name.toLowerCase(), 'id', queryFilter)
        .load(id);
    if (items.length === 0) {
        throw new Error(`Row not found: ${id}`);
    }
    return {
        ...formatItem(items[0], jsonFields),
        _args: queryFilter
    };
}
const getNestedResolver = (columnName) => async (parent, args, context, info) => {
    const { getLoader } = context;
    const queryFilter = {
        block: parent._args?.block,
        indexer: parent._args?.indexer
    };
    const returnType = (0, graphql_2.getNonNullType)(info.returnType);
    const jsonFields = getJsonFields((0, graphql_2.getNonNullType)(returnType.ofType));
    const parentType = (0, graphql_2.getNonNullType)(info.parentType);
    const field = parentType.getFields()[info.fieldName];
    const fieldType = info.returnType instanceof graphql_1.GraphQLNonNull
        ? info.returnType.ofType
        : info.returnType;
    if (!(0, graphql_1.isListType)(fieldType))
        return [];
    const derivedFromDirective = (0, graphql_2.getDerivedFromDirective)(field);
    let result = [];
    if (!derivedFromDirective) {
        const loaderResult = await getLoader(columnName, 'id', queryFilter).loadMany(parent[info.fieldName]);
        // NOTE: loader returns array of arrays when used with loadMany, because in some cases,
        // for example when fetching derived entities we expect multiple results for a single id
        // this is why we need to flatten it. In the future it would be nice to have clearer API
        result = loaderResult.flat();
    }
    else {
        const fieldArgument = derivedFromDirective.arguments?.find(arg => arg.name.value === 'field');
        if (!fieldArgument || fieldArgument.value.kind !== 'StringValue') {
            throw new Error(`field ${field.name} is missing field in derivedFrom directive`);
        }
        result = await getLoader(columnName, fieldArgument.value.value, queryFilter).load(parent.id);
    }
    return result.map(item => ({
        ...formatItem(item, jsonFields),
        _args: queryFilter
    }));
};
exports.getNestedResolver = getNestedResolver;
function getJsonFields(type) {
    return Object.values(type.getFields()).filter(field => {
        const baseType = (0, graphql_2.getNonNullType)(field.type);
        return (0, graphql_1.isListType)(baseType) && baseType.ofType instanceof graphql_1.GraphQLScalarType;
    });
}
function formatItem(item, jsonFields) {
    const formatted = { ...item };
    jsonFields.forEach(field => {
        if (typeof formatted[field.name] === 'string') {
            formatted[field.name] = JSON.parse(formatted[field.name]);
        }
    });
    return formatted;
}
