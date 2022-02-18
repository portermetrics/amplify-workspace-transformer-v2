> 🚒 Add workspaces based auth flow to all queries and mutations!

# graphql-workspace-authorizer-transformer-v2

This transformer is intended to be used with @model and @auth directives.
If you don't implement @auth directive, you may have vulnerabilities like Sandbox bypass.

##Local instalation, run this command located in the project where you want to install this module

`npm install /path/to/root/graph-workdpace-authorizer-v2`

##Build

`npm run-script build`


## Installation

`npm install --save @porterm/graphql-workspace-authorizer-transformer-v2`

## How to use

### Setup custom transformer

Edit `amplify/backend/api/<YOUR_API>/transform.conf.json` and append `"@porterm/graphql-workspace-authorizer-transformer-v2"` to the `transformers` field.

```json
"transformers": [
    "@porterm/graphql-workspace-authorizer-transformer-v2"
]
```

### Use @workspaceAuthV2 directive

Append `@workspaceAuthV2` to target types and add the params.

```graphql
type Todo @model @workspaceAuthV2(
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
      cognitoGroupExceptions: ["Administrator"]
      ) {
  id: ID!
  title: String!
  description: String
}
```

## Contribute 🦸

Please feel free to create, comment and of course solve some of the issues. To get started you can also go for the easier issues marked with the `good first issue` label if you like.

### Development

- It is important to always make sure the version of the installed `graphql` dependency matches the `graphql` version the `graphql-transformer-core` depends on.

## License

The [MIT License](LICENSE)

## Credits

The _graphql-workspace-authorizer-transformer-v2_ project is maintained by Porter Metrics