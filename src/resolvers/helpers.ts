import {
    Expression,
    methodCall,
    ref,
  } from 'graphql-mapping-template';  
  

export const getIdentityClaimExp = (value: Expression, defaultValueExp: Expression): Expression => {
    return methodCall(ref('util.defaultIfNull'), methodCall(ref('ctx.identity.claims.get'), value), defaultValueExp);
};