import { DirectiveNode, ObjectTypeDefinitionNode } from '/opt/amazon/lib/node_modules/@aws-amplify/cli/node_modules/graphql';

export type WorkspaceModelOperation = 'create' | 'update' | 'delete' | 'read';

export type DefaultValueDirectiveConfiguration = {
  object: ObjectTypeDefinitionNode;
  directive: DirectiveNode;
  ownershipModel: OwnershipModel,
  rules: Array<WorkspaceRule>
  cognitoGroupExceptions: Array<String>,
};


export interface OwnershipModel {
    modelName: string;
    userIdFieldName: string; // this is the user field wich will be used to find user owned workspaces
    workspaceIdFieldName: string; // this is the workspace field id wich will be used to check workspace ownership
    indexName: string;
    roleFieldName: string;
  }

export interface WorkspaceRule {
    groups: string[];
    operations: WorkspaceModelOperation[];
  }

export const worspaceDirectiveDefinition = `
  directive @workspaceAuthV2(ownershipModel: OwnershipModel, rules: [WorkspaceRule!], cognitoGroupExceptions: [String]) on OBJECT | FIELD_DEFINITION
  input OwnershipModel {
    modelName: String!
    userIdFieldName: String!
    workspaceIdFieldName: String!
    indexName: String!
    roleFieldName: String!
  }
  input WorkspaceRule {
    groups: [String]
    operations: [WorkspaceModelOperation]
  }
  enum WorkspaceModelOperation {
    create
    update
    delete
    read
  }
`;
