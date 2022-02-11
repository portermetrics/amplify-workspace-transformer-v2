import { COGNITO_AUTH_TYPE } from '../utils/constants';
import { OwnershipModel } from '../utils/definitions';
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
  
export const generateSetWorkspaceToStashPostDataLoadSnippets = (ownershipModel: OwnershipModel): {} => {
    return { 
        "req":printBlock("Add workspace id to stash if it is in the items result")(
            ifElse(
                equals(ref('util.authType()'), str(COGNITO_AUTH_TYPE)),
                compoundExpression([
                    iff(
                        and([not(ref(`util.isNull($ctx.prev.result)`)), not(ref(`util.isNull($ctx.prev.result.${ownershipModel.workspaceIdFieldName})`))]),
                        qref(`$ctx.stash.put("workspaceID", $ctx.prev.result.${ownershipModel.workspaceIdFieldName})`)
                    ),
                    iff(
                        and([not(ref(`util.isNull($ctx.prev.result)`)), not(ref(`util.isNullOrEmpty($ctx.prev.result.items)`)), not(ref(`ctx.prev.result.items.isEmpty()`))]),
                        compoundExpression([
                        qref(`$ctx.stash.put("workspaceID", $ctx.prev.result.items[0].${ownershipModel.workspaceIdFieldName})`),
                        forEach(
                            ref('item'), 
                            ref('ctx.prev.result.items'), 
                            [
                            iff(
                                ref(`ctx.stash.workspaceID != $item.${ownershipModel.workspaceIdFieldName}`),
                                ref('util.unauthorized()')
                            )
                            ]
                        ),
                        ])
                    )
                    ]),
                    ref("util.toJson({\"version\":\"2018-05-29\",\"payload\":{}})")
            )
    ),
    "res":printBlock('Continue with prev result')(
        ref("util.toJson($ctx.prev.result)")
    )
  };
};