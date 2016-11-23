// This code is taken from:
// https://raw.githubusercontent.com/graphql/graphql-js/c614f759df5e436b1092af53811311b254ebb189/src/utilities/separateOperations.js
// according to the term of the BSD-style license provided there and copied below
//
// This is copied from graphql-js 0.7 so that optics can rely on it
// being available even when used with a graphql-js 0.6 server.
//
// No substantial changes have been made -- it has been modified to
// compile as ES6 and export additional symbols, but should be
// functionally equivalent to the original.


/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {visit} from 'graphql/language';
import {DocumentNode, OperationDefinitionNode} from 'graphql/language/ast';

/**
 * separateOperations accepts a single AST document which may contain many
 * operations and fragments and returns a collection of AST documents each of
 * which contains a single operation as well the fragment definitions it
 * refers to.
 */
export function separateOperations(documentAST) {

    const operations = [];
    const depGraph = Object.create(null);
    let fromName;

    // Populate the list of operations and build a dependency graph.
    visit(documentAST, {
        OperationDefinition(node) {
            operations.push(node);
            fromName = opName(node);
        },
        FragmentDefinition(node) {
            fromName = node.name.value;
        },
        FragmentSpread(node) {
            const toName = node.name.value;
            (depGraph[fromName] || (depGraph[fromName] = Object.create(null)))[toName] = true;
        }
    }, undefined);

    // For each operation, produce a new synthesized AST which includes only what
    // is necessary for completing that operation.
    const separatedDocumentASTs = Object.create(null);
    operations.forEach(operation => {
        const operationName = opName(operation);
        const dependencies = Object.create(null);
        collectTransitiveDependencies(dependencies, depGraph, operationName);

        separatedDocumentASTs[operationName] = {
            kind: 'Document',
            definitions: documentAST.definitions.filter(def =>
                def === operation ||
                def.kind === 'FragmentDefinition' && dependencies[def.name.value]
            )
        };
    });

    return separatedDocumentASTs;
}

// Provides the empty string for anonymous operations.
export function opName(operation) {
    return operation.name ? operation.name.value : '';
}

// From a dependency graph, collects a list of transitive dependencies by
// recursing through a dependency graph.
function collectTransitiveDependencies(collected, depGraph, fromName) {
    const immediateDeps = depGraph[fromName];
    if (immediateDeps) {
        Object.keys(immediateDeps).forEach(toName => {
            if (!collected[toName]) {
                collected[toName] = true;
                collectTransitiveDependencies(collected, depGraph, toName);
            }
        });
    }
}
