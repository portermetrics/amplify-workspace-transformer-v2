import { ModelTransformer } from '@aws-amplify/graphql-model-transformer';
import { GraphQLTransform } from '@aws-amplify/graphql-transformer-core';
import { AppSyncAuthConfiguration } from '@aws-amplify/graphql-transformer-interfaces';
import WorkspaceAuthorizerTransformerV2 from "../index";


// test("Transformer can be executed without errors", () => {
//   const authConfig: AppSyncAuthConfiguration = {
//     defaultAuthentication: {
//       authenticationType: 'AMAZON_COGNITO_USER_POOLS',
//     },
//     additionalAuthenticationProviders: [],
//   };
//   const validSchema = `
//   type Ownership {
//     id: ID!
//     UserId: ID!
//     title: String!
//     companyID: ID!
//     createdAt: String
//     updatedAt: String
//   }  
  
//   type Post @model @workspaceAuthV2 {
//       id: ID!
//       title: String!
//       companyID: ID!
//       createdAt: String
//       updatedAt: String
//     }`;
//   const transformer = new GraphQLTransform({
//     authConfig,
//     transformers: [new ModelTransformer(), new WorkspaceAuthorizerTransformerV2()],
//   });
//   expect(() => transformer.transform(validSchema)).toThrowError(
//     "Ownership model datasource OwnershipTable doesn't exist"
//   );
// });

// test("@workspaceAuthV2 directive must be used together with @model directive", () => {
//   const authConfig: AppSyncAuthConfiguration = {
//     defaultAuthentication: {
//       authenticationType: 'AMAZON_COGNITO_USER_POOLS',
//     },
//     additionalAuthenticationProviders: [],
//   };
//   const invalidSchema = `
//   type Ownership {
//     id: ID!
//     UserId: ID!
//     title: String!
//     companyID: ID!
//     createdAt: String
//     updatedAt: String
//   }  
  
//   type Post @workspaceAuthV2 {
//       id: ID!
//       title: String!
//       companyID: ID!
//       createdAt: String
//       updatedAt: String
//     }`;
//   const transformer = new GraphQLTransform({
//     authConfig,
//     transformers: [new ModelTransformer(), new WorkspaceAuthorizerTransformerV2()],
//   });
//   expect(() => transformer.transform(invalidSchema)).toThrowError(
//     "Types annotated with @workspaceAuthV2 must also be annotated with @model."
//   );
// });