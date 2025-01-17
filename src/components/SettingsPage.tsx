import React, { useState, useEffect } from "react";
import { WorkflowState } from "../types";
import WorkflowChain from "./WorkflowChain";
import WorkflowList from "./WorkflowList";
import WorkflowCreationForm from "./WorkflowCreationForm";
import { prettyColors } from "../constants";

// Setup logger with timestamp
const log = {
  info: (msg: string, data?: any) => console.log(`[SettingsPage][${new Date().toISOString()}] INFO: ${msg}`, data ? data : ''),
  error: (msg: string, error?: any) => console.error(`[SettingsPage][${new Date().toISOString()}] ERROR: ${msg}`, error ? error : ''),
  debug: (msg: string, data?: any) => console.debug(`[SettingsPage][${new Date().toISOString()}] DEBUG: ${msg}`, data ? data : '')
};

interface SettingsPageProps {
  WorkflowHeads: WorkflowState[];
  onWorkflowStateChange: (action: 'add-head' | 'add-extension' | 'update-circular' | 'delete-workflow' | 'delete-state' | 'update-state' | 'update-checkbox', state: WorkflowState, parentId?: number) => void;
  onClose: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  WorkflowHeads,
  onWorkflowStateChange,
  onClose,
}) => {
  const [newState, setNewState] = useState<WorkflowState>({
    id: 0,
    keyword: "",
    color: prettyColors[0],
    next: undefined,
    circular: false
  });
  const [workflows, setWorkflows] = useState<WorkflowState[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<number | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  // Update local state whenever WorkflowHeads changes
  useEffect(() => {
    log.debug('WorkflowHeads updated, syncing local state', { count: WorkflowHeads.length });
    setWorkflows(WorkflowHeads);
    // Reset selected workflow if it no longer exists
    if (selectedWorkflow && !WorkflowHeads.find(w => w.id === selectedWorkflow)) {
      log.debug('Selected workflow no longer exists, resetting selection');
      setSelectedWorkflow(null);
    }
    // Force re-render when workflows change
    setRenderKey(prev => prev + 1);
  }, [WorkflowHeads]);

  // Force layout recalculation on mount
  useEffect(() => {
    log.debug('Settings page mounted, forcing layout recalculation');
    const forceReflow = () => {
      const container = document.querySelector('.settings-container');
      if (container) {
        container.getBoundingClientRect();
      }
    };
    forceReflow();
    
    // Add resize handler
    window.addEventListener('resize', forceReflow);
    return () => window.removeEventListener('resize', forceReflow);
  }, []);

  const handleAddStateToWorkflow = (workflowId: number) => {
    if (!newState.keyword.trim()) return;

    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    // Create new state with proper circular property
    const newStateWithId: WorkflowState = {
      ...newState,
      id: Date.now(),
      color: prettyColors[Math.floor(Math.random() * prettyColors.length)],
      circular: workflow.circular ?? false, // Use nullish coalescing to handle undefined
      hasCheckbox: workflow.hasCheckbox, // Copy hasCheckbox property from workflow
      checkboxState: workflow.checkboxState // Copy checkboxState property from workflow
    };

    // If the workflow is circular, the new state should point to the head
    if (workflow.circular) {
      newStateWithId.next = workflow;
      log.debug('Added circular reference to new state', { workflowId, newStateId: newStateWithId.id });
    }

    onWorkflowStateChange('add-extension', newStateWithId, workflowId);
    setNewState(prev => ({ ...prev, keyword: "" })); // Reset the form
    log.debug('Added new state to workflow', { workflowId, newState: newStateWithId });
    // Force re-render after adding state
    setRenderKey(prev => prev + 1);
  };

  // Helper function to safely copy a workflow chain
  const copyWorkflowChain = (workflow: WorkflowState): { head: WorkflowState, last: WorkflowState } => {
    const statesList: WorkflowState[] = [];
    const stateMap = new Map<number, number>();
    const visited = new Set<number>();
    
    // First pass: create all states and detect circularity
    let current: WorkflowState | undefined = workflow;
    // Start with the workflow's explicit circular property
    let isCircular = workflow.circular ?? false;
    
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const newState: WorkflowState = {
        id: current.id,
        keyword: current.keyword,
        color: current.color,
        next: undefined,
        circular: isCircular
      };
      statesList.push(newState);
      stateMap.set(current.id, statesList.length - 1);
      
      // If next points back to head, we've confirmed it's circular
      // Only update isCircular if it wasn't already set
      if (!isCircular && current.next?.id === workflow.id) {
        isCircular = true;
        // Update all previous states to be circular
        statesList.forEach(state => {
          state.circular = true;
        });
      }
      current = current.next;
    }

    // Second pass: connect the states
    for (let i = 0; i < statesList.length; i++) {
      let nextState = null;
      
      if (i < statesList.length - 1) {
        // Connect to next state in chain
        nextState = statesList[i + 1];
      } else if (isCircular) {
        // Last state connects back to head if circular
        nextState = statesList[0];
      }
      
      if (nextState) {
        statesList[i].next = nextState;
      }
    }

    return { 
      head: statesList[0], 
      last: statesList[statesList.length - 1] 
    };
  };

  const handleCircularChange = (workflowId: number, isCircular: boolean) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    log.debug('Handling circular change', { workflowId, isCircular, currentWorkflow: workflow });

    // Create a deep copy of the workflow chain
    const { head: workflowHead, last } = copyWorkflowChain(workflow);

    // Preserve checkbox state
    const preserveCheckbox = (state: WorkflowState) => {
      state.hasCheckbox = workflow.hasCheckbox;
      state.checkboxState = workflow.checkboxState;
      if (state.next && state.next.id !== workflowHead.id) {
        preserveCheckbox(state.next);
      }
    };
    preserveCheckbox(workflowHead);

    // Update circularity for all states in the chain
    const updateCircular = (state: WorkflowState) => {
      state.circular = isCircular;
      if (state.next && state.next.id !== workflowHead.id) {
        updateCircular(state.next);
      }
    };
    updateCircular(workflowHead);

    // Update the last state's next pointer
    if (isCircular) {
      last.next = workflowHead;
    } else {
      last.next = undefined;
    }

    log.debug('Updated workflow chain', { 
      workflowId, 
      isCircular, 
      head: workflowHead,
      last
    });

    // Update the workflow in the local state
    setWorkflows(prevWorkflows => 
      prevWorkflows.map(w => 
        w.id === workflowId ? workflowHead : w
      )
    );

    onWorkflowStateChange('update-circular', workflowHead, workflowId);
  };

  const handleNewStateChange = (state: WorkflowState) => {
    log.debug('New state change', { state });
    setNewState(state);
  };

  const handleStateChange = (state: WorkflowState) => {
    log.debug('State change in workflow', { state });
    // Find the workflow that contains this state
    const workflow = workflows.find(w => {
      let current: WorkflowState | undefined = w;
      const visited = new Set<number>();
      while (current && !visited.has(current.id)) {
        if (current.id === state.id) return true;
        visited.add(current.id);
        current = current.next;
      }
      return false;
    });

    if (workflow) {
      // Notify parent of the change using the new update-state action
      onWorkflowStateChange('update-state', state, workflow.id);
    }
  };

  const handleDeleteState = (state: WorkflowState) => {
    log.debug('Deleting state', { state });
    if (state.parentId) {
      onWorkflowStateChange('delete-state', state, state.parentId);
    }
  };

  const handleCheckboxChange = (workflowId: number, hasCheckbox: boolean, checkboxState?: WorkflowState) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    log.debug('Handling checkbox change', { workflowId, hasCheckbox, checkboxState, currentWorkflow: workflow });

    // Create a deep copy of the workflow chain
    const { head: workflowHead, last } = copyWorkflowChain(workflow);

    // Update checkbox for all states in the chain
    const updateCheckbox = (state: WorkflowState) => {
      state.hasCheckbox = hasCheckbox;
      state.checkboxState = checkboxState;
      if (state.next && state.next.id !== workflowHead.id) {
        updateCheckbox(state.next);
      }
    };
    updateCheckbox(workflowHead);

    log.debug('Updated workflow chain', { 
      workflowId, 
      hasCheckbox,
      checkboxState,
      head: workflowHead,
      last
    });

    // Update the workflow in the local state
    setWorkflows(prevWorkflows => 
      prevWorkflows.map(w => 
        w.id === workflowId ? workflowHead : w
      )
    );

    onWorkflowStateChange('update-checkbox', workflowHead, workflowId);
  };

  return (
    <div key={renderKey} className="settings-container" style={{
      padding: "24px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: "#1A1A1A",
      borderRadius: "12px",
      maxWidth: "800px",
      width: "95%",
      margin: "0 auto",
      boxShadow: "0 4px 40px rgba(0, 0, 0, 0.4)",
      color: "#E6E6E6",
      overflowX: "hidden",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      position: "fixed",
      left: "50%",
      top: "40px",
      transform: "translateX(-50%)",
      zIndex: 9999,
    }}>
      <style>
        {`
          .settings-container {
            position: fixed;
            isolation: isolate;
          }
          .close-button {
            background-color: transparent;
            border: none;
            color: #999;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            border-radius: 6px;
            transition: all 0.2s ease;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            right: 20px;
            top: 20px;
            z-index: 100;
            pointer-events: auto;
            line-height: 1;
          }
          .close-button:hover {
            background-color: rgba(255, 255, 255, 0.08);
            color: #fff;
          }
          .close-button span {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
          }
        `}
      </style>
      <div style={{
        display: "flex",
        alignItems: "center",
        marginBottom: "16px",
        paddingRight: "40px",
      }}>
        <h2 style={{
          margin: 0,
          fontSize: "18px",
          fontWeight: "500",
          color: "#FFFFFF",
          letterSpacing: "-0.01em",
        }}>Workflow Settings</h2>
      </div>
      <button 
        onClick={async (e) => {
          try {
            e.stopPropagation();
            log.info('Close button clicked');
            await onClose();
            log.info('Settings closed successfully');
          } catch (error) {
            log.error('Failed to close settings', error);
          }
        }} 
        className="close-button"
      ><span>✕</span></button>

      <WorkflowCreationForm
        onAddWorkflow={(workflow: WorkflowState) => {
          log.debug('Creating new workflow', workflow);
          onWorkflowStateChange('add-head', workflow);
        }}
        prettyColors={prettyColors}
      />

      <WorkflowList
        workflows={workflows}
        selectedWorkflow={selectedWorkflow}
        newState={newState}
        onStateChange={handleStateChange}
        onNewStateChange={handleNewStateChange}
        onAddStateToWorkflow={handleAddStateToWorkflow}
        onSelectWorkflow={setSelectedWorkflow}
        onCircularChange={handleCircularChange}
        onCheckboxChange={handleCheckboxChange}
        onDeleteWorkflow={(workflow: WorkflowState) => {
          log.debug('Deleting workflow', workflow);
          onWorkflowStateChange('delete-workflow', workflow);
        }}
        onDeleteState={handleDeleteState}
        prettyColors={prettyColors}
      />

      {workflows.length > 0 && <div style={{
        marginTop: "12px",
        marginBottom: "-8px",
        padding: "4px",
        fontSize: "14px",
        color: "rgba(255, 255, 255, 0.6)",
        fontWeight: "300",
        letterSpacing: "0.02em",
        lineHeight: "1.5",
        textAlign: "center",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif"
      }}>
        Tip: use the <span style={{
          backgroundColor: "rgba(66, 153, 225, 0.15)",
          padding: "2px 6px",
          borderRadius: "4px",
          color: "rgba(255, 255, 255, 0.8)"
        }}>Workflow Query</span> command to generate queries for your workflows
      </div>}
    </div>
  );
}

export default SettingsPage;