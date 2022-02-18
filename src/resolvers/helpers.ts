import {
    Expression,
    methodCall,
    ref,
  } from 'C:\\Users\\sebas\\AppData\\Roaming\\npm\\node_modules\\@aws-amplify\\cli\\node_modules\\graphql-mapping-template';  
  

export const getIdentityClaimExp = (value: Expression, defaultValueExp: Expression): Expression => {
    return methodCall(ref('util.defaultIfNull'), methodCall(ref('ctx.identity.claims.get'), value), defaultValueExp);
};
