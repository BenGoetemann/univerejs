import { Agent } from "./base/agent";
import { State } from "./base/state";
import { Pipe } from "./architectures/pipe";
import { Graph } from "./base/graph";

export { Agent, State, Pipe, Graph }

// EVALUATIONS
import {
    isSet,
    gt,
    lt,
    eq,
    neq,
    notEmpty,
    contains,
    between,
    evaluate,
    and,
    or,
    startsWith,
    endsWith,
    matches,
    isEmpty,
    notContains,
    gte,
    lte,
} from "./lifecycle/evaluations";

export {
    isSet,
    gt,
    lt,
    eq,
    neq,
    notEmpty,
    contains,
    between,
    evaluate,
    and,
    or,
    startsWith,
    endsWith,
    matches,
    isEmpty,
    notContains,
    gte,
    lte,
};

// STATE MANIPULATIONS
import { set } from "./lifecycle/stateManipulations";

export {
    set
}

// PROMPT INJECTIONS

import { focusOn, chooseBetween } from "./lifecycle/promptInjections";

export {focusOn, chooseBetween}

// TOOLS

import { createTool } from "./base/tools";

export {
    createTool
}