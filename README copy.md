> 🚒 Add workspaces based auth flow to all queries and mutations!

# graphql-workspace-authorizer-transformer

##Local instalation, run this command located in the project where you want to install this module

`npm install /path/to/root/graph-workdpace-authorizer`

##Build

`npm run-script build`


## Installation

`npm install --save graphql-workspace-authorizer-transformer`

## How to use

### Setup custom transformer

Edit `amplify/backend/api/<YOUR_API>/transform.conf.json` and append `"graphql-workspace-authorizer-transformer"` to the `transformers` field.

```json
"transformers": [
    "graphql-workspace-authorizer-transformer"
]
```

### Use @workspaceAuth directive

Append `@workspaceAuth` to target types and add the params.

```graphql
type Todo @model @workspaceAuth(ownershipModelName:"Ownership", userField:"userID", indexName:"byUser", roleField:"role", allowedRoles:["Editor", "Admin", "Owner"], relatedWorkspaceIDField:"companyID") {
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

The _graphql-workspace-authorizer-transformer_ library is maintained by Porter Metrics