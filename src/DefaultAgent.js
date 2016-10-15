// This file contains the global state for default Agent object. Most
// users will only want one agent, and it can be convienient not to
// have to share an Agent instance between the various instrumentation
// call sites.

import Agent from './Agent';


let defaultAgent = null;

// This is used to pass options to the default Agent. Call it at most
// once before any other calls.
export const configureAgent = (options) => {
  if (defaultAgent) {
    defaultAgent.debugFn('Error: default agent already configured.');
    return;
  }

  defaultAgent = new Agent(options);

  return;
};

export const instrumentSchema = (schema) => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.instrumentSchema(schema);
};

export const middleware = () => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.middleware();
};

export const instrumentHapiServer = (server) => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.instrumentHapiServer(server);
};

export const context = (req) => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.context(req);
};
