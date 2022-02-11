import { COGNITO_AUTH_TYPE } from '../utils/constants';
import { OwnershipModel, WorkspaceRule } from '../utils/definitions';
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
    toJson,
    isNullOrEmpty,
    DynamoDBMappingTemplate,
  } from 'C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\graphql-mapping-template';

export const generateSetWorkspaceToStashOnInitSnippets = (ownershipModel: OwnershipModel): {} => {
    return { 
      "req": printBlock("Add workspace id from input args to stash on init slot")(
      compoundExpression([
        iff(
          and([not(ref(`util.isNull($ctx.args.input)`)),  not(ref(`util.isNull($ctx.args.input.${ownershipModel.workspaceIdFieldName})`))]),
          qref(`$ctx.stash.put("workspaceID", $ctx.args.input.${ownershipModel.workspaceIdFieldName})`)
        ),
        obj({}),
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
        "req": printBlock('Get Request template')(ifElse(equals(ref('util.authType()'), str(COGNITO_AUTH_TYPE)),compoundExpression(statements), obj({}))),
        "res": printBlock('Add workspace to stash and return prev result')(compoundExpression(workspaceToStash))
    };
};

