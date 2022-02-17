import { COGNITO_AUTH_TYPE, IS_AUTHORIZED_FLAG } from '../utils/constants';
import { OwnershipModel, WorkspaceRule } from '../utils/definitions';
import { getIdentityClaimExp } from './helpers'
import {
    compoundExpression,
    set,
    obj,
    methodCall,
    printBlock,
    qref,
    ref,
    str,
    raw,
    equals,
    bool,
    nul,
    int,
    iff,
    ifElse,
    and,
    forEach,
    not,
    or,
    list,
    isNullOrEmpty,
    DynamoDBMappingTemplate,
  } from 'graphql-mapping-template';  
  

export const generateOwnershipSyncValidatorFilterSnippets = (ownershipModel:OwnershipModel, rules: WorkspaceRule[], cognitoGroupExceptions: Array<String>, operationType:string): {} => {
    return { 
        "req": printBlock(`Get the ownership from dynamodb`)(
        ifElse(
            equals(ref('util.authType()'), str(COGNITO_AUTH_TYPE)),
            compoundExpression([
            DynamoDBMappingTemplate.query({
                query: obj({
                expression: str('#userID = :userID'),
                expressionNames: obj({
                    '#userID': str(ownershipModel.userIdFieldName),
                }),
                expressionValues: obj({
                    ':userID': obj({
                    S: str("${context.identity.username}"),
                    })
                }),
                }),
                scanIndexForward: bool(true),
                filter: nul(),
                limit: int(1),
                index: str(ownershipModel.indexName)
            })
            ]),
            ref("util.toJson({\"version\":\"2018-05-29\",\"payload\":{}})")
        )
        ),
        "res":printBlock('Setting ${fieldName} to be the default owner')(
        compoundExpression([
                iff(ref('ctx.error'),ref('util.error($ctx.error.message, $ctx.error.type)')),
                iff(
                    equals(ref('util.authType()'), str(COGNITO_AUTH_TYPE)),
                    compoundExpression([
                        set(ref(IS_AUTHORIZED_FLAG), bool(false)),
                        iff(
                            not(ref(IS_AUTHORIZED_FLAG)),
                            compoundExpression([
                                set(ref('staticGroupRoles'), raw(JSON.stringify(cognitoGroupExceptions.map(r => ({ claim: "cognito:groups", entity: r }))))),
                                forEach(ref('groupRole'), ref('staticGroupRoles'), [
                                    set(ref('groupsInToken'), getIdentityClaimExp(ref('groupRole.claim'), list([]))),
                                    iff(
                                    methodCall(ref('groupsInToken.contains'), ref('groupRole.entity')),
                                    compoundExpression([set(ref(IS_AUTHORIZED_FLAG), bool(true)), raw(`#break`)]),
                                    ),
                                ]),
                            ])
                        ),
                        iff(
                            not(ref(IS_AUTHORIZED_FLAG)),
                            compoundExpression([
                                iff(
                                    or([
                                        isNullOrEmpty(ref('ctx.result.items')), 
                                        ref('ctx.result.items.isEmpty()'), 
                                    ]),
                                    ref('util.unauthorized()'),
                                    ),
                                set(ref('staticRules'), raw(JSON.stringify(rules))),
                                ifElse(
                                    or([isNullOrEmpty(ref('ctx.stash.authFilter')), isNullOrEmpty(ref('ctx.stash.authFilter.or'))]),
                                    set(ref('authFilter'), list([])),
                                    set(ref('authFilter'), ref('ctx.stash.authFilter.or')),
                                ),
                                forEach(ref('rule'), ref('staticRules'), [
                                    forEach(ref('item'), ref('ctx.result.items'), [
                                        iff(
                                            and([
                                            methodCall(ref('rule.groups.contains'), ref(`item.${ownershipModel.roleFieldName}`)),
                                            methodCall(ref('rule.operations.contains'), str(operationType))
                                            ]),
                                            qref(methodCall(ref('authFilter.add'), raw(`{"${ownershipModel.workspaceIdFieldName}": { "eq": $item.companyID }}`))),
                                        ),
                                    ]),
                                ]),
                                iff(
                                    not(methodCall(ref('authFilter.isEmpty'))),
                                        qref(methodCall(ref('ctx.stash.put'), str('authFilter'), raw(`{ "or": $authFilter }`))),
                                ),
                            ]),
                        ),
                    ]),
                ),
                iff(and([not(ref(IS_AUTHORIZED_FLAG)), methodCall(ref('util.isNull'), ref('ctx.stash.authFilter'))]), ref('util.unauthorized()')),
                ref("util.toJson($ctx.prev.result)")
            ]),
        ),
    };
};