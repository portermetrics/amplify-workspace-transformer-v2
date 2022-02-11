import { QueryFieldType, MutationFieldType } from "C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\@aws-amplify/graphql-transformer-interfaces";
import { ModelDirectiveConfiguration, SubscriptionLevel } from 'C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\@aws-amplify/graphql-model-transformer';
import { DefaultValueDirectiveConfiguration } from "./definitions";
import { DirectiveNode } from "C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\graphql";
import { DirectiveWrapper } from "C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\@aws-amplify/graphql-transformer-core";
import { toCamelCase, plurality } from "C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\graphql-transformer-common";
import md5 from 'md5';

export const getModelConfig = (directive: DirectiveNode, typeName: string, isDataStoreEnabled = false): ModelDirectiveConfiguration => {
    const directiveWrapped: DirectiveWrapper = new DirectiveWrapper(directive);
    const options = directiveWrapped.getArguments<ModelDirectiveConfiguration>({
      queries: {
        get: toCamelCase(['get', typeName]),
        list: toCamelCase(['list', plurality(typeName, true)]),
        ...(isDataStoreEnabled ? { sync: toCamelCase(['sync', plurality(typeName, true)]) } : undefined),
      },
      mutations: {
        create: toCamelCase(['create', typeName]),
        update: toCamelCase(['update', typeName]),
        delete: toCamelCase(['delete', typeName]),
      },
      subscriptions: {
        level: SubscriptionLevel.on,
        onCreate: [ensureValidSubscriptionName(toCamelCase(['onCreate', typeName]))],
        onDelete: [ensureValidSubscriptionName(toCamelCase(['onDelete', typeName]))],
        onUpdate: [ensureValidSubscriptionName(toCamelCase(['onUpdate', typeName]))],
      },
      timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      },
    });
    return options;
  };

  const ensureValidSubscriptionName = (name: string): string => {
    if (name.length <= 50) return name;
  
    return name.slice(0, 45) + md5(name).slice(0, 5);
  };
  

export const getQueryFieldNames = (
    modelDirectiveConfig: ModelDirectiveConfiguration,
  ): Set<{ fieldName: string; typeName: string; type: QueryFieldType }> => {
    const fields: Set<{ fieldName: string; typeName: string; type: QueryFieldType }> = new Set();
    if (modelDirectiveConfig?.queries?.get) {
      fields.add({
        typeName: 'Query',
        fieldName: modelDirectiveConfig.queries.get,
        type: QueryFieldType.GET,
      });
    }
  
    if (modelDirectiveConfig?.queries?.list) {
      fields.add({
        typeName: 'Query',
        fieldName: modelDirectiveConfig.queries.list,
        type: QueryFieldType.LIST,
      });
    }
  
    if (modelDirectiveConfig?.queries?.sync) {
      fields.add({
        typeName: 'Query',
        fieldName: modelDirectiveConfig.queries.sync,
        type: QueryFieldType.SYNC,
      });
    }
    return fields;
  };
  
  export const getMutationFieldNames = (
    modelDirectiveConfig: ModelDirectiveConfiguration,
  ): Set<{ fieldName: string; typeName: string; type: MutationFieldType }> => {
    // Todo: get fields names from the directives
    const getMutationType = (type: string): MutationFieldType => {
      switch (type) {
        case 'create':
          return MutationFieldType.CREATE;
        case 'update':
          return MutationFieldType.UPDATE;
        case 'delete':
          return MutationFieldType.DELETE;
        default:
          throw new Error('Unknown mutation type');
      }
    };
  
    const fieldNames: Set<{ fieldName: string; typeName: string; type: MutationFieldType }> = new Set();
    for (let [mutationType, mutationName] of Object.entries(modelDirectiveConfig?.mutations || {})) {
      if (mutationName) {
        fieldNames.add({
          typeName: 'Mutation',
          fieldName: mutationName,
          type: getMutationType(mutationType),
        });
      }
    }
  
    return fieldNames;
  };
  
  export const getSubscriptionFieldNames = (
    modelDirectiveConfig: ModelDirectiveConfiguration,
  ): Set<{
    fieldName: string;
    typeName: string;
  }> => {
    const fields: Set<{
      fieldName: string;
      typeName: string;
    }> = new Set();
  
    if (modelDirectiveConfig?.subscriptions?.level === SubscriptionLevel.on) {
      if (modelDirectiveConfig?.subscriptions?.onCreate && modelDirectiveConfig.mutations?.create) {
        for (const fieldName of modelDirectiveConfig.subscriptions.onCreate) {
          fields.add({
            typeName: 'Subscription',
            fieldName: fieldName,
          });
        }
      }
  
      if (modelDirectiveConfig?.subscriptions?.onUpdate && modelDirectiveConfig.mutations?.update) {
        for (const fieldName of modelDirectiveConfig.subscriptions.onUpdate) {
          fields.add({
            typeName: 'Subscription',
            fieldName: fieldName,
          });
        }
      }
  
      if (modelDirectiveConfig?.subscriptions?.onDelete && modelDirectiveConfig.mutations?.delete) {
        for (const fieldName of modelDirectiveConfig.subscriptions.onDelete) {
          fields.add({
            typeName: 'Subscription',
            fieldName: fieldName,
          });
        }
      }
    }
  
    return fields;
  };