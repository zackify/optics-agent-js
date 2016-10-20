import Agent from './Agent';
import { configureAgent, instrumentSchema, middleware,
         instrumentHapiServer, context } from './DefaultAgent';

// export both as individual symbols and as a default object to
// support both of these syntaxes:
//   import OpticsAgent from 'optics-agent';
//   import { middleware, instrumentSchema } from 'optics-agent';
//
// Or with CommonJS:
//   var OpticsAgent = require('optics-agent');
export default {
  configureAgent,
  instrumentSchema,
  middleware,
  instrumentHapiServer,
  context,
  Agent,
};

export {
  configureAgent,
  instrumentSchema,
  middleware,
  instrumentHapiServer,
  context,
  Agent,
};
