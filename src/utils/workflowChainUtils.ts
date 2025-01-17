import { WorkflowState } from "../types";
import { createLogger } from "./workflowLogger";

const log = createLogger('WorkflowChainUtils');

export const getWorkflowChain = (workflow: WorkflowState): WorkflowState[] => {
  log.debug('Generating workflow chain', { startId: workflow.id });
  const chain: WorkflowState[] = [];
  const visited = new Set<number>();
  let current: WorkflowState | undefined = workflow;

  // Handle single-state circular workflow
  if (workflow.next && workflow.next.id === workflow.id) {
    log.debug('Single-state circular workflow detected');
    return [workflow, {...workflow, isLoop: true}];
  }

  // Build the chain and detect cycles
  while (current && !visited.has(current.id)) {
    chain.push(current);
    visited.add(current.id);
    current = current.next;

    // If we've reached a state that points back to the head
    if (current?.id === workflow.id) {
      if (workflow.circular) {
        chain.push({...current, isLoop: true});
      }
      break;
    }
  }

  log.debug('Generated workflow chain', { 
    chainLength: chain.length, 
    states: chain.map(s => ({ id: s.id, keyword: s.keyword })),
    isCircular: workflow.circular,
    hasCycle: current !== undefined
  });
  return chain;
}; 