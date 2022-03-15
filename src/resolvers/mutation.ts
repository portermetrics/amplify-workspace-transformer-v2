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
    list,
    bool,
    nul,
    int,
    iff,
    ifElse,
    and,
    forEach,
    not,
    toJson,
    isNullOrEmpty,
    DynamoDBMappingTemplate,
  } from '/opt/amazon/lib/node_modules/@aws-amplify/cli/node_modules/graphql-mapping-template';

export const generateSetWorkspaceToStashOnInitSnippets = (ownershipModel: OwnershipModel): {} => {
    return { 
      "req": printBlock("Add workspace id from input args to stash on init slot")(
      compoundExpression([
        iff(
          and([not(ref(`util.isNull($ctx.args.input)`)),  not(ref(`util.isNull($ctx.args.input.${ownershipModel.workspaceIdFieldName})`))]),
          qref(`$ctx.stash.put("workspaceID", $ctx.args.input.${ownershipModel.workspaceIdFieldName})`)
        ),
        ref("util.toJson({\"version\":\"2018-05-29\",\"payload\":{}})"),
      ])
    ),
    "res":printBlock('Continue with prev result')(
      ref("util.toJson($ctx.prev.result)")
    )
  };
};



export const generateGetRequestTemplateSnippets = (ownershipModel: OwnershipModel): {} => {
    const statements = [
        set(ref('GetRequest'), obj({ version: str('2018-05-29'), operation: str('GetItem') })),
        ifElse(
          ref('ctx.stash.metadata.modelObjectKey'),
          set(ref('key'), ref('ctx.stash.metadata.modelObjectKey')),
          compoundExpression([set(ref('key'), obj({ id: methodCall(ref('util.dynamodb.toDynamoDB'), ref('ctx.args.input.id')) }))]),
        ),
        qref(methodCall(ref('GetRequest.put'), str('key'), ref('key'))),
        toJson(ref('GetRequest')),
      ];

      const workspaceToStash = [
            iff(equals(ref('util.authType()'), str(COGNITO_AUTH_TYPE)),iff(and([not(ref(`util.isNull($ctx.result)`)), not(ref(`util.isNull($ctx.result.${ownershipModel.workspaceIdFieldName})`))]),
            qref(`$ctx.stash.put("workspaceID", $ctx.result.${ownershipModel.workspaceIdFieldName})`)
            )),
            ref("util.toJson($ctx.prev.result)")
        ]
      return {
        "req": printBlock('Get Request template')(compoundExpression(statements)),
        "res": printBlock('Add workspace to stash and return prev result')(compoundExpression(workspaceToStash))
    };
};

export const generateOwnershipMutationValidatorSnippets = (ownershipModel:OwnershipModel, rules: WorkspaceRule[], cognitoGroupExceptions: Array<String>, operationType:string): {} => {
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
                    set(ref('staticRules'), raw(JSON.stringify(rules))),
                    forEach(ref('rule'), ref('staticRules'), [
                      iff(
                        and([
                          not(isNullOrEmpty(ref('ctx.result.items'))), 
                          not(ref('ctx.result.items.isEmpty()')), 
                          methodCall(ref('rule.groups.contains'), ref(`ctx.result.items[0].${ownershipModel.roleFieldName}`)),
                          methodCall(ref('rule.operations.contains'), str(operationType))
                        ]),
                        compoundExpression([set(ref(IS_AUTHORIZED_FLAG), bool(true)), raw(`#break`)]),
                      ),
                    ]),
                  ]),
                ),
                iff(not(ref(IS_AUTHORIZED_FLAG)), ref('util.unauthorized()')),
              ]),
          ),
          ref("util.toJson($ctx.prev.result)"),
        ])
      )
    };
  };
