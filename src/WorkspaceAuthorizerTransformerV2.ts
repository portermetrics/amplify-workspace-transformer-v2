import {
  DirectiveWrapper,
  MappingTemplate,
  TransformerPluginBase,
  InvalidDirectiveError,
  TransformerContractError,
} from 'C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\@aws-amplify/graphql-transformer-core';
import {
  TransformerContextProvider,
  TransformerResolverProvider,
  TransformerSchemaVisitStepContextProvider,
  DataSourceProvider,
  QueryFieldType,
  MutationFieldType,
} from 'C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\@aws-amplify/graphql-transformer-interfaces';
import { DirectiveNode, ObjectTypeDefinitionNode, Kind, NameNode, InterfaceTypeDefinitionNode, FieldDefinitionNode } from 'C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\graphql';
import { OwnershipModel, WorkspaceRule, worspaceDirectiveDefinition, DefaultValueDirectiveConfiguration } from './utils/definitions';
import { getModelConfig, getMutationFieldNames, getQueryFieldNames } from './utils/schema';
import { ModelDirectiveConfiguration } from 'C:\\Users\\alexi\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\@aws-amplify/graphql-model-transformer';
import { generateOwnershipValidatorSnippets } from './resolvers/common';
import { generateGetRequestTemplateSnippets, generateSetWorkspaceToStashOnInitSnippets } from './resolvers/mutation';
import { generateSetWorkspaceToStashPostDataLoadSnippets } from './resolvers/query';



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
    const modelDirective = definition.directives?.find(dir => dir.name.value === 'model');
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
        indexName: "byUserId",
        roleFieldName: "role"
      },
      rules: [{
        groups: ["owner", "admin", "editor"],
        operations: ["create", "update", "delete", "read"]
      }] 
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
            this.protectGetResolver(context, def, query.typeName, query.fieldName, modelName);
            break;
          case QueryFieldType.LIST:
            this.protectListResolver(context, def, query.typeName, query.fieldName, modelName);
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

  protectGetResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const ownershipSnippets: any = generateOwnershipValidatorSnippets(config.ownershipModel, config.rules, "read")
    const setWorkspaceToStashInitSnippet: any = generateSetWorkspaceToStashOnInitSnippets(config.ownershipModel)
    const setWorkspaceToStashPostDataLoadSnippet: any = generateSetWorkspaceToStashPostDataLoadSnippets(config.ownershipModel)

    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;
    
    resolver.addToSlot(
      'postDataLoad',
      MappingTemplate.s3MappingTemplateFromString(
        setWorkspaceToStashPostDataLoadSnippet["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        setWorkspaceToStashPostDataLoadSnippet["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      )
    );
    resolver.addToSlot(
      'postDataLoad',
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
  protectListResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
    indexName?: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const ownershipSnippets: any = generateOwnershipValidatorSnippets(config.ownershipModel, config.rules, "read")
    const setWorkspaceToStashInitSnippet: any = generateSetWorkspaceToStashOnInitSnippets(config.ownershipModel)
    const setWorkspaceToStashPostDataLoadSnippet: any = generateSetWorkspaceToStashPostDataLoadSnippets(config.ownershipModel)
    
    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;
    resolver.addToSlot(
      'postDataLoad',
      MappingTemplate.s3MappingTemplateFromString(
        setWorkspaceToStashPostDataLoadSnippet["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        setWorkspaceToStashPostDataLoadSnippet["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      )
    );
    resolver.addToSlot(
      'postDataLoad',
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
      const ownershipSnippets: any = generateOwnershipValidatorSnippets(config.ownershipModel, config.rules, "read")
      const setWorkspaceToStashInitSnippet: any = generateSetWorkspaceToStashOnInitSnippets(config.ownershipModel)
      const setWorkspaceToStashPostDataLoadSnippet: any = generateSetWorkspaceToStashPostDataLoadSnippets(config.ownershipModel)
      
      const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;
      resolver.addToSlot(
        'postDataLoad',
        MappingTemplate.s3MappingTemplateFromString(
          setWorkspaceToStashPostDataLoadSnippet["req"],
          `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
        ),
        MappingTemplate.s3MappingTemplateFromString(
          setWorkspaceToStashPostDataLoadSnippet["res"],
          `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
        )
      );
      resolver.addToSlot(
        'postDataLoad',
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
    const ownershipSnippets: any = generateOwnershipValidatorSnippets(config.ownershipModel, config.rules, "read")
    const setWorkspaceToStashInitSnippet: any = generateSetWorkspaceToStashOnInitSnippets(config.ownershipModel)
    const setWorkspaceToStashPostDataLoadSnippet: any = generateSetWorkspaceToStashPostDataLoadSnippets(config.ownershipModel)
    
    const datasource = ctx.api.host.getDataSource(`${config.ownershipModel.modelName}Table`) as DataSourceProvider;
    resolver.addToSlot(
      'postDataLoad',
      MappingTemplate.s3MappingTemplateFromString(
        setWorkspaceToStashPostDataLoadSnippet["req"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.req.vtl`,
      ),
      MappingTemplate.s3MappingTemplateFromString(
        setWorkspaceToStashPostDataLoadSnippet["res"],
        `${typeName}.${fieldName}.{slotName}.{slotIndex}.res.vtl`,
      )
    );
    resolver.addToSlot(
      'postDataLoad',
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
 
  protectCreateResolver = (
    ctx: TransformerContextProvider,
    def: ObjectTypeDefinitionNode,
    typeName: string,
    fieldName: string,
    modelName: string,
  ): void => {
    const resolver = ctx.resolvers.getResolver(typeName, fieldName) as TransformerResolverProvider;
    const config = this.directiveMap.get(modelName) as DefaultValueDirectiveConfiguration
    const ownershipSnippets: any = generateOwnershipValidatorSnippets(config.ownershipModel, config.rules, "create")
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
    const ownershipSnippets: any = generateOwnershipValidatorSnippets(config.ownershipModel, config.rules, "update")
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
    const ownershipSnippets: any = generateOwnershipValidatorSnippets(config.ownershipModel, config.rules, "delete")
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