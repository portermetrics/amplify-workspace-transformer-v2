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
  } from '/opt/amazon/lib/node_modules/@aws-amplify/cli/node_modules/graphql-mapping-template';  
  
export const generateSetWorkspaceToStashPostDataLoadSnippets = (ownershipModel: OwnershipModel): {} => {
    return { 
        "req":printBlock("Add workspace id to stash if it is in the items result")(
            compoundExpression([
                iff(
                    equals(ref('util.authType()'), str(COGNITO_AUTH_TYPE)),
                    iff(
                        not(ref(`util.isNull($ctx.args.${ownershipModel.workspaceIdFieldName})`)),
                        qref(`$ctx.stash.put("workspaceID", $ctx.args.${ownershipModel.workspaceIdFieldName})`)
                    ),
                ),
                obj({}),
            ]),
    ),
    "res":printBlock('Continue with prev result')(
        ref("util.toJson({})")
    )
  };
};

export const generateOwnershipGetValidatorFilterSnippets = (ownershipModel:OwnershipModel, rules: WorkspaceRule[], cognitoGroupExceptions: Array<String>, operationType:string): {} => {
    return { 
        "req": printBlock(`Get the ownership from dynamodb`)(
            compoundExpression([
            DynamoDBMappingTemplate.query({
                query: obj({
                expression: str('#userID = :userID and #workspaceID = :workspaceID'),
                expressionNames: obj({
                    '#userID': str(ownershipModel.userIdFieldName),
                    '#workspaceID': str(ownershipModel.workspaceIdFieldName),
                }),
                expressionValues: obj({
                    ':userID': obj({
                    S: str("${context.identity.username}"),
                    }),
                    ":workspaceID" : obj({
                      S: str("${context.stash.workspaceID}"),
                    })
                }),
                }),
                scanIndexForward: bool(true),
                filter: nul(),
                limit: int(1),
                index: str(ownershipModel.indexName)
            })
            ])
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
                                forEach(ref('rule'), ref('staticRules'), [
                                    forEach(ref('item'), ref('ctx.result.items'), [
                                        iff(
                                            and([
                                            methodCall(ref('rule.groups.contains'), ref(`item.${ownershipModel.roleFieldName}`)),
                                            methodCall(ref('rule.operations.contains'), str(operationType))
                                            ]),
                                            set(ref(IS_AUTHORIZED_FLAG), bool(true)),
                                        ),
                                    ]),
                                ]),
                            ]),
                        ),
                        iff(not(ref(IS_AUTHORIZED_FLAG)), ref('util.unauthorized()')),
                    ]),
                ),
                
                ref("util.toJson($ctx.prev.result)")
            ]),
        ),
    };
};
