import {
  Expression,
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
  isNullOrEmpty,
  DynamoDBMappingTemplate,
} from 'C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\graphql-mapping-template';
import { COGNITO_AUTH_TYPE, IS_AUTHORIZED_FLAG } from '../utils/constants';
import { OwnershipModel, WorkspaceRule } from '../utils/definitions';
  
  
export const generateOwnershipValidatorSnippets = (ownershipModel:OwnershipModel, rules: WorkspaceRule[], operationType:string): {} => {
  return { 
    "req": printBlock(`Get the ownership from dynamodb`)(
      ifElse(
        equals(ref('util.authType()'), str(COGNITO_AUTH_TYPE)),
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
              set(ref('staticRules'), raw(JSON.stringify(rules))),
              forEach(ref('rule'), ref('staticRules'), [
                iff(
                  and([
                    methodCall(ref('rule.groups.contains'), ref(`ctx.result.${ownershipModel.roleFieldName}`)),
                    methodCall(ref('rule.operations.contains'), str(operationType))
                  ]),
                  compoundExpression([set(ref(IS_AUTHORIZED_FLAG), bool(true)), raw(`#break`)]),
                ),
              ]),
              iff(not(ref(IS_AUTHORIZED_FLAG)), ref('util.unauthorized()')),
            ]),
        ),
        ref("util.toJson($ctx.prev.result)"),
      ])
    )
  };
};