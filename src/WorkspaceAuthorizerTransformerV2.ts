import {
  DirectiveWrapper,
  MappingTemplate,
  TransformerPluginBase,
  TransformerContractError,
} from '@aws-amplify/graphql-transformer-core';
import {
  TransformerContextProvider,
  TransformerResolverProvider,
  TransformerSchemaVisitStepContextProvider,
  DataSourceProvider,
  QueryFieldType,
  MutationFieldType,
} from '@aws-amplify/graphql-transformer-interfaces';
import { DirectiveNode, ObjectTypeDefinitionNode } from 'graphql';
import { worspaceDirectiveDefinition, DefaultValueDirectiveConfiguration } from './utils/definitions';
import { getModelConfig, getMutationFieldNames, getQueryFieldNames } from './utils/schema';
import { ModelDirectiveConfiguration } from '@aws-amplify/graphql-model-transformer';
import { generateGetRequestTemplateSnippets, generateOwnershipMutationValidatorSnippets, generateSetWorkspaceToStashOnInitSnippets } from './resolvers/mutation';
import { generateSetWorkspaceToStashPostDataLoadSnippets, generateOwnershipGetValidatorFilterSnippets} from './resolvers/query';
import { generateOwnershipSyncValidatorFilterSnippets } from './resolvers/sync';



export class WorkspaceAuthorizerTransformerV2 extends TransformerPluginBase {
  private directiveMap = new Map<string, DefaultValueDirectiveConfiguration>();
  private modelDirectiveConfig: Map<string, ModelDirectiveConfiguration>;

  constructor() {
    super('WorkspaceAuthorizerTransformerV2', worspaceDirectiveDefinition);
    this.modelDirectiveConfig = new Map();
  }

  object = (
    definition: ObjectTypeDefinitionNode,
    directive: DirectiveNode,
    ctx: TransformerSchemaVisitStepContextProvider,
  ): void => {
    const modelDirective = definition.directives?.find((dir: { name: { value: string; }; }) => dir.name.value === 'model');
    if (!modelDirective) {
      throw new TransformerContractError('Types annotated with @workspaceAuthV2 must also be annotated with @model.');
    }
    const directiveWrapped = new DirectiveWrapper(directive);
    const config = directiveWrapped.getArguments<DefaultValueDirectiveConfiguration>({ 
      object: definition, 
      directive: directive, 
      ownershipModel: {
        modelName: "Ownership",
        userIdFieldName: "userID",
        workspaceIdFieldName: "companyID",
        indexName: "byUserIdAndCompanyId",
        roleFieldName: "role"
      },
      rules: [{
        groups: ["owner", "admin", "editor"],
        operations: ["create", "update", "delete", "read"]
      }] ,
      cognitoGroupExceptions: []
    });
    this.directiveMap.set(definition.name.value, config);
    this.modelDirectiveConfig.set(definition.name.value, getModelConfig(modelDirective, definition.name.value, ctx.isProjectUsingDataStore()));
  };

  generateResolvers = (context: TransformerContextProvider): void => {

    for (const modelName of this.directiveMap.keys()) {
      const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
      if (!context.api.host.hasDataSource(`${config.ownershipModel.modelName}Table`)) {
        throw new Error(`Ownership model datasource ${config.ownershipModel.modelName}Table doesn't exist`);
      }
      const modelConfig = this.modelDirectiveConfig.get(modelName)
      const def = context.output.getObject(modelName)!;

      const queryFields = getQueryFieldNames(modelConfig!);
      for (let query of queryFields.values()) {
        switch (query.type) {
          case QueryFieldType.GET:
            this.protectQueryResolver(context, def, query.typeName, query.fieldName, modelName);
            break;
          case QueryFieldType.LIST:
            this.protectQueryResolver(context, def, query.typeName, query.fieldName, modelName);
            break;
          case QueryFieldType.SYNC:
            this.protectSyncResolver(context, def, query.typeName, query.fieldName, modelName);
            break;
          default:
            throw new TransformerContractError('Unkown query field type');
        }
      }

      const mutationFields = getMutationFieldNames(modelConfig!);
      for (let mutation of mutationFields.values()) {
        switch (mutation.type) {
          case MutationFieldType.CREATE:
            this.protectCreateResolver(context, def, mutation.typeName, mutation.fieldName, modelName);
            break;
          case MutationFieldType.UPDATE:
            this.protectUpdateResolver(context, def, mutation.typeName, mutation.fieldName, modelName);
            break;
          case MutationFieldType.DELETE:
            this.protectDeleteResolver(context, def, mutation.typeName, mutation.fieldName, modelName);
            break;
          default:
            throw new TransformerContractError('Unknown Mutation field type');
        }
      }
    } 
    
  };

  protectQueryResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const workspaceAuthFilterSnippets: any = generateOwnershipGetValidatorFilterSnippets(config.ownershipModel, config.rules, config.cognitoGroupExceptions, "read")
    const workspaceIdInitSnippets: any = generateSetWorkspaceToStashPostDataLoadSnippets(config.ownershipModel)

    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;

    resolver.addToSlot(
      'init',
      MappingTemplate.s3MappingTemplateFromString(
        workspaceIdInitSnippets["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      )
    );

    resolver.addToSlot(
      'postAuth',
      MappingTemplate.s3MappingTemplateFromString(
        workspaceAuthFilterSnippets["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        workspaceAuthFilterSnippets["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      ),
      datasource
    );
  };

  protectSyncResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    if (ctx.isProjectUsingDataStore()) {
      const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
      const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
      const workspaceAuthFilterSnippets: any = generateOwnershipSyncValidatorFilterSnippets(config.ownershipModel, config.rules, config.cognitoGroupExceptions, "read")

      const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;

      resolver.addToSlot(
        'postAuth',
        MappingTemplate.s3MappingTemplateFromString(
          workspaceAuthFilterSnippets["req"],
          `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
        ),
        MappingTemplate.s3MappingTemplateFromString(
          workspaceAuthFilterSnippets["res"],
          `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
        ),
        datasource
      );
    }
  };
  /*
  Searchable Auth
  Protects
    - Search Query
    - Agg Query
  */
  protectSearchResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const workspaceAuthFilterSnippets: any = generateOwnershipGetValidatorFilterSnippets(config.ownershipModel, config.rules, config.cognitoGroupExceptions, "read")
    const workspaceIdInitSnippets: any = generateSetWorkspaceToStashPostDataLoadSnippets(config.ownershipModel)

    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;
    
    resolver.addToSlot(
      'init',
      MappingTemplate.s3MappingTemplateFromString(
        workspaceIdInitSnippets["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        workspaceIdInitSnippets["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      )
    );

    resolver.addToSlot(
      'postAuth',
      MappingTemplate.s3MappingTemplateFromString(
        workspaceAuthFilterSnippets["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        workspaceAuthFilterSnippets["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      ),
      datasource
    );
  };
 
  protectCreateResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const ownershipSnippets: any = generateOwnershipMutationValidatorSnippets(config.ownershipModel, config.rules, config.cognitoGroupExceptions, "create")
    const setWorkspaceToStashInitSnippet: any = generateSetWorkspaceToStashOnInitSnippets(config.ownershipModel)
    
    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;
    resolver.addToSlot(
      'init',
      MappingTemplate.s3MappingTemplateFromString(
        setWorkspaceToStashInitSnippet["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      )
    );
    resolver.addToSlot(
      'auth',
      MappingTemplate.s3MappingTemplateFromString(
        ownershipSnippets["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        ownershipSnippets["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      ),
      datasource
    );
  };
  protectUpdateResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const ownershipSnippets: any = generateOwnershipMutationValidatorSnippets(config.ownershipModel, config.rules, config.cognitoGroupExceptions, "update")
    const getRequestTemplateSnippets:any = generateGetRequestTemplateSnippets(config.ownershipModel)
    
    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;

    const currentModelDatasource = ctx.api.host.getDataSource(`${def.name.value}Table`) as DataSourceProvider;
    resolver.addToSlot(
      'auth',
      MappingTemplate.s3MappingTemplateFromString(getRequestTemplateSnippets["req"], `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`),
      MappingTemplate.s3MappingTemplateFromString(getRequestTemplateSnippets["res"], `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`),
      currentModelDatasource,
    );
    resolver.addToSlot(
      'auth',
      MappingTemplate.s3MappingTemplateFromString(
        ownershipSnippets["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        ownershipSnippets["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      ),
      datasource
    );
  };

  protectDeleteResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const ownershipSnippets: any = generateOwnershipMutationValidatorSnippets(config.ownershipModel, config.rules, config.cognitoGroupExceptions, "delete")
    const getRequestTemplateSnippets:any = generateGetRequestTemplateSnippets(config.ownershipModel)
    
    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;

    const currentModelDatasource = ctx.api.host.getDataSource(`${def.name.value}Table`) as DataSourceProvider;
    resolver.addToSlot(
      'auth',
      MappingTemplate.s3MappingTemplateFromString(getRequestTemplateSnippets["req"], `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`),
      MappingTemplate.s3MappingTemplateFromString(getRequestTemplateSnippets["res"], `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`),
      currentModelDatasource,
    );
    resolver.addToSlot(
      'auth',
      MappingTemplate.s3MappingTemplateFromString(
        ownershipSnippets["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        ownershipSnippets["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      ),
      datasource
    );
  };

}
