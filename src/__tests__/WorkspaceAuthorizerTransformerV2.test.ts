import { GraphQLTransform } from "graphql-transformer-core";
import { DynamoDBModelTransformer } from "graphql-dynamodb-transformer";
import WorkspaceAuthorizerTransformerV2 from "../index";

import {
  obj,
  str,
  ref,
  printBlock,
  print,
  compoundExpression,
  qref,
  raw,
  and,
  iff,
  int,
  not,
  or,
  forEach,
  bool,
  ifElse,
  nul,
  DynamoDBMappingTemplate,
} from "graphql-mapping-template";

// @ts-ignore
import { AppSyncTransformer } from "graphql-appsync-transformer";

import {
  plurality,
} from "graphql-transformer-common";

const transformer = new GraphQLTransform({
  transformers: [
    new AppSyncTransformer(),
    new DynamoDBModelTransformer(),
    new WorkspaceAuthorizerTransformerV2(),
  ],
});

// test("@workspaceAuth directive can not be used on fields", () => {
//   const schema = `
//     type ExpiringChatMessage @model {
//       id: ID!
//       title: String!
//       description: String @workspaceAuth
//     }
//   `;
//   expect(() => transformer.transform(schema)).toThrowError(
//     'Directive "workspaceAuth" may not be used on FIELD_DEFINITION.'
//   );
// });

// test("@workspaceAuth directive must be used together with @model directive", () => {
//   const schema = `
//       type Todo @workspaceAuth {
//         id: ID!
//         title: String!
//         description: String
//       }
//     `;
//   expect(() => transformer.transform(schema)).toThrowError(
//     "Types annotated with @workspaceAuth must also be annotated with @model."
//   );
// });

test("Transformer can be executed without errors", () => {
  const schema = `
    type Todo @model @workspaceAuth {
        id: ID!
        title: String!
        description: String
    }
  `;
  console.log(transformer.transform(schema))
  // expect(() => transformer.transform(schema)).not.toThrow();
});

// test("Transformer can be executed without errors", () => {
//   let result = print(
//     compoundExpression([
//       iff(
//         and([not(ref(`util.isNull($ctx.result)`)), not(ref(`util.isNull($ctx.result.asdf)`))]),
//         qref(`$ctx.stash.put("workspaceID", $ctx.result.asdf)`)
//       ),
//       iff(
//         and([not(ref(`util.isNull($ctx.result)`)), not(ref(`util.isNullOrEmpty($ctx.result.items)`)), not(ref(`util.isNull($ctx.result.items[0].asdf)`))]),
//         compoundExpression([
//           qref(`$ctx.stash.put("workspaceID", $ctx.result.items[0].asdfas)`),
//           forEach(
//             ref('item'), 
//             ref('context.result.items'), 
//             [
//               iff(
//                 ref(`ctx.stash.workspaceID != $item.asdfs`),
//                 ref('util.unauthorized()')
//               )
//             ]
//           ),
//         ])
//       ),
//       obj({prueba:str("sdfsdf")}),
//     ])
//   )

//   console.log(result)
// });
