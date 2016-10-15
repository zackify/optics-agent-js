import Agent from './Agent';
import { configureAgent, instrumentSchema, middleware,
         instrumentHapiServer, context } from './DefaultAgent';

// export both as individual symbols and as a default object to
// support the syntax:
// import OpticsAgent from 'optics-agent';
// AND
// var OpticsAgent = require('optics-agent');
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
