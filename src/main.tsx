/**
 * Main plugin logic
 */
import "@logseq/libs";
import React from "react";
import ReactDOM from "react-dom/client";
import { DEFAULT_STATES } from "./constants";
import { WorkflowState } from "./types";
import { WorkflowMacro } from "./components/WorkflowMacro";
import SettingsPage from "./components/SettingsPage";
import WorkflowQuery from "./components/WorkflowQuery";
import settingsIcon from "./assets/IconBW.svg";
import { createLogger } from "./utils/workflowLogger";

// Setup logger
const log = createLogger('Workflow');

let workflowStates: WorkflowState[] = [...DEFAULT_STATES];
let isInitialized = false;
let idCounter = 0;

// Keep track of rendered workflow macros
const renderedMacros: Map<string, {
  rootElement: HTMLElement;
  reactRoot: ReactDOM.Root;
}> = new Map();

/**
 * Serializes a workflow state chain into a format that can be safely stored
 * by removing circular references and storing just the IDs
 */
function serializeWorkflow(workflow: WorkflowState): any {
  const visited = new Set<number>();
  const result: any[] = [];
  
  let current: WorkflowState | undefined = workflow;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    result.push({
      id: current.id,
      keyword: current.keyword,
      color: current.color,
      nextId: current.next?.id,
      circular: current.circular,
      hasCheckbox: current.hasCheckbox,
      checkboxState: current.checkboxState ? {
        id: current.checkboxState.id,
        keyword: current.checkboxState.keyword,
        color: current.checkboxState.color
      } : undefined
    });
    current = current.next;
  }
  
  return result;
}

/**
 * Deserializes a workflow chain from storage format back into
 * a linked structure with proper circular references
 */
function deserializeWorkflow(serialized: any[]): WorkflowState {
  // First create all the state objects without links
  const states = new Map<number, WorkflowState>();
  serialized.forEach(item => {
    states.set(item.id, {
      id: item.id,
      keyword: item.keyword,
      color: item.color,
      next: undefined,
      circular: item.circular,
      hasCheckbox: item.hasCheckbox,
      checkboxState: item.checkboxState ? {
        id: item.checkboxState.id,
        keyword: item.checkboxState.keyword,
        color: item.checkboxState.color
      } : undefined
    });
  });
  
  // Then connect them
  serialized.forEach(item => {
    if (item.nextId !== undefined) {
      const state = states.get(item.id);
      const nextState = states.get(item.nextId);
      if (state && nextState) {
        state.next = nextState;
      }
    }
  });
  
  return states.get(serialized[0].id)!;
}

/**
 * Updates settings and re-registers slash commands
 */
async function updateWorkflowState() {
  log.debug('Updating workflow states in settings');
  
  // Serialize workflows before saving to settings
  const serializedWorkflows = workflowStates.map(serializeWorkflow);
  await logseq.updateSettings({ 
    serializedWorkflows
  });
  
  // Force re-render of any open workflow macros
  log.debug('Re-rendering open workflow macros');
  const workflowSlots = document.querySelectorAll('[id^="workflow-"]');
  workflowSlots.forEach(slot => {
    const id = slot.id;
    const reactRoot = ReactDOM.createRoot(slot);
    const blockId = id.replace('workflow-', '');
    const keyword = slot.getAttribute('data-keyword');
    if (keyword) {
      const currentWorkflowState = findWorkflowStateById(workflowStates, parseInt(keyword));
      if (currentWorkflowState) {
        log.debug('Re-rendering workflow macro', { blockId, keyword });
        reactRoot.render(
          <WorkflowMacro
            blockId={blockId}
            initWorkflowState={currentWorkflowState}
            workflowStates={workflowStates}
          />
        );
      }
    }
  });
}

/**
 * Re-renders all workflow macros with the updated state
 */
function reRenderWorkflowMacros(): void {
  log.info('Re-rendering all workflow macros');
  log.startTimer('render-all-macros');
  
  try {
    const macroCount = renderedMacros.size;
    log.debug('Starting macro re-render', { macroCount });
    
    renderedMacros.forEach((macro, id) => {
      log.startTimer(`render-macro-${id}`);
      try {
        const stateId = parseInt(macro.rootElement.getAttribute('data-state-id') || '-999');
        const blockId = macro.rootElement.getAttribute('data-block-id');
        
        log.debug('Re-rendering individual macro', { 
          id, 
          stateId, 
          blockId,
          hasRoot: !!macro.reactRoot,
          elementExists: !!macro.rootElement
        });
        
        if (stateId) {
          const currentWorkflowState = findWorkflowStateById(workflowStates, stateId);
          if (currentWorkflowState) {
            log.debug('Found workflow state for macro', { 
              id, 
              stateId, 
              keyword: currentWorkflowState.keyword,
              hasCheckbox: currentWorkflowState.hasCheckbox,
              isCircular: currentWorkflowState.circular
            });
            
            if (blockId) {
              macro.reactRoot.render(
                <WorkflowMacro
                  blockId={blockId}
                  initWorkflowState={currentWorkflowState}
                  workflowStates={workflowStates}
                />
              );
              log.perf('Macro rendered successfully', { id, stateId });
            } else {
              log.warn('Missing blockId for macro', { id, stateId });
            }
          } else {
            log.warn('Workflow state not found for macro', { id, stateId });
          }
        }
      } catch (error) {
        log.error('Error rendering individual macro', { error, id });
      } finally {
        log.endTimer(`render-macro-${id}`);
      }
    });
  } catch (error) {
    log.error('Error in reRenderWorkflowMacros', error);
  } finally {
    log.endTimer('render-all-macros');
    log.perf('Completed re-rendering all macros', { 
      macroCount: renderedMacros.size 
    });
  }
}

/**
 * Handles all workflow state changes - both adding new heads and extending existing workflows
 */
async function handleWorkflowStateChange(action: 'add-head' | 'add-extension' | 'update-circular' | 'update-checkbox' | 'delete-workflow' | 'delete-state' | 'update-state', state: WorkflowState, parentId?: number): Promise<void> {
  log.startTimer(`workflow-state-change-${action}`);
  log.info('Handling workflow state change', { action, state, parentId });
  
  try {
    // Generate new ID for new states
    if (action === 'add-head' || action === 'add-extension') {
      state.id = generateShortId();
      log.debug('Generated new state ID', { id: state.id });
    }
    
    if (action === 'update-state' && parentId) {
      log.debug('Updating state properties', { parentId, state });
      const workflow = workflowStates.find(wf => wf.id === parentId);
      if (workflow) {
        // Create a new workflow chain with the updated state
        const newChain: WorkflowState[] = [];
        const visited = new Set<number>();
        let current: WorkflowState | undefined = workflow;
        
        while (current && !visited.has(current.id)) {
          visited.add(current.id);
          if (current.id === state.id) {
            // Update this state's properties but preserve its next pointer
            newChain.push({
              ...state,
              next: current.next
            });
          } else {
            newChain.push({...current});
          }
          current = current.next;
        }

        // Update the workflow chain
        for (let i = 0; i < newChain.length - 1; i++) {
          newChain[i].next = newChain[i + 1];
        }
        // If circular, connect last to first
        if (workflow.circular && newChain.length > 0) {
          newChain[newChain.length - 1].next = newChain[0];
        }

        // Update the workflow state
        workflowStates = workflowStates.map(wf => 
          wf.id === parentId ? newChain[0] : wf
        );
        await updateWorkflowState();
        // Force settings UI update
        reopenSettingsPage();
      }
    } else if (action === 'add-head') {
      log.debug('Adding new workflow head', state);
      workflowStates = [...workflowStates, state];
      await updateWorkflowState();
      registerSlashCommands(); // Re-register commands after adding new workflow
      // Force settings UI update
      reopenSettingsPage();
    } else if (action === 'add-extension' && parentId) {
      log.debug('Adding extension to existing workflow', { parentId, state });
      const workflow = workflowStates.find(wf => wf.id === parentId);
      if (workflow) {
        // Find the last state in the chain before it loops back
        let current = workflow;
        const visited = new Set<number>([workflow.id]);
        
        while (current.next && !visited.has(current.next.id)) {
          current = current.next;
          visited.add(current.id);
        }
        
        // Insert the new state and maintain circularity
        const isCircular = current.next === workflow;
        if (isCircular) {
          state.next = workflow; // Point back to head
        }
        current.next = state;  // Insert into chain
        
        workflowStates = [...workflowStates];
        await updateWorkflowState();
        registerSlashCommands(); // Re-register commands after adding new state
        log.debug('Updated workflow chain', workflow);
      } else {
        log.error('Parent workflow not found', parentId);
      }
    } else if (action === 'update-circular' && parentId) {
      log.debug('Updating workflow circularity', { parentId, state });
      // Replace the entire workflow state with the updated one
      workflowStates = workflowStates.map(wf => 
        wf.id === parentId ? state : wf
      );
      await updateWorkflowState();
      registerSlashCommands(); // Re-register commands after updating circularity
    } else if (action === 'update-checkbox' && parentId) {
      log.debug('Updating workflow checkbox state', { parentId, state });
      // Replace the entire workflow state with the updated one
      workflowStates = workflowStates.map(wf => 
        wf.id === parentId ? state : wf
      );
      await updateWorkflowState();
      registerSlashCommands(); // Re-register commands after updating checkbox state
    } else if (action === 'delete-workflow') {
      log.debug('Deleting workflow', state);
      workflowStates = workflowStates.filter(wf => wf.id !== state.id);
      await updateWorkflowState();
      registerSlashCommands(); // Re-register commands after deleting workflow
      // Force settings UI update
      reopenSettingsPage();
    } else if (action === 'delete-state' && parentId) {
      log.debug('Deleting state from workflow', { parentId, stateId: state.id });
      const workflow = workflowStates.find(wf => wf.id === parentId);
      if (workflow) {
        // If deleting the head state, remove the entire workflow
        if (workflow.id === state.id) {
          workflowStates = workflowStates.filter(wf => wf.id !== workflow.id);
          await updateWorkflowState();
          registerSlashCommands(); // Re-register commands after deleting workflow head
          // Force settings UI update since we're removing a workflow
          reopenSettingsPage();
        } else {
          // Find the state that points to the one being deleted
          let current: WorkflowState | undefined = workflow;
          let prev: WorkflowState | undefined;
          const visited = new Set<number>();

          while (current && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.next?.id === state.id) {
              prev = current;
              break;
            }
            current = current.next;
          }

          if (prev) {
            // Connect previous state to the state after the deleted one
            prev.next = state.next;
            
            // If we're breaking a circular reference, make sure to update the circular flag
            if (state.next && state.next === workflow && prev !== workflow) {
              let temp = workflow;
              const visited = new Set<number>();
              while (temp && !visited.has(temp.id)) {
                temp.circular = false;
                visited.add(temp.id);
                if (temp.next) {
                  temp = temp.next;
                } else {
                  break;
                }
              }
            }

            // Update the workflow state
            workflowStates = [...workflowStates];
            await updateWorkflowState();
            registerSlashCommands(); // Re-register commands after modifying workflow
            // Force settings UI update
            reopenSettingsPage();
          }
        }
      }
    }

    // Re-render all workflow macros with the updated state
    log.startTimer('re-render-workflow-macros');
    await reRenderWorkflowMacros();
    log.endTimer('re-render-workflow-macros');
    
  } catch (error) {
    log.error('Failed to handle workflow state change', { error, action, state, parentId });
    throw error;
  } finally {
    log.endTimer(`workflow-state-change-${action}`);
  }
}

/**
 * Forces a re-render of the settings page
 */
function reopenSettingsPage(): void {
  log.info('Forcing settings page re-render');
  const rootElement = document.getElementById('app');
  if (rootElement) {
    const reactRoot = ReactDOM.createRoot(rootElement);
    // Force re-render by using a key that changes
    reactRoot.render(
      <SettingsPage
        key={Date.now()} // Force re-mount on each reopen
        WorkflowHeads={workflowStates}
        onWorkflowStateChange={handleWorkflowStateChange}
        onClose={async () => {
          log.info('Closing settings page');
          // Ensure settings are saved before closing
          await updateWorkflowState();
          logseq.hideMainUI();
        }}
      />
    );
  } else {
    log.error("Plugin root element not found");
  }
}

/**
 * Opens the settings page in a floating modal.
 */
function openSettingsPage(): void {
  log.info('Opening settings page');
  const rootElement = document.getElementById('app');
  if (rootElement) {
    const reactRoot = ReactDOM.createRoot(rootElement);
    reactRoot.render(
      <SettingsPage
        key={Date.now()} // Force re-mount on initial open
        WorkflowHeads={workflowStates}
        onWorkflowStateChange={handleWorkflowStateChange}
        onClose={async () => {
          log.info('Closing settings page');
          // Ensure settings are saved before closing
          await updateWorkflowState();
          logseq.hideMainUI();
        }}
      />
    );
  } else {
    log.error("Plugin root element not found");
  }
}

function findWorkflowStateById(workflowStates: WorkflowState[], id: number): WorkflowState | undefined {
  log.debug('Searching for workflow state by id', id);
  
  // First find the workflow head that contains this id
  let targetWorkflow: WorkflowState | undefined;
  let targetState: WorkflowState | undefined;

  for (const workflow of workflowStates) {
    let current: WorkflowState | undefined = workflow;
    const visited = new Set<number>();
    
    while (current && !visited.has(current.id)) {
      // Check the current state's id
      if (current.id === id) {
        targetWorkflow = workflow;
        targetState = current;
        break;
      }
      
      // Check if this state has a checkbox state with matching id
      if (current.hasCheckbox && current.checkboxState?.id === id) {
        targetWorkflow = workflow;
        targetState = current.checkboxState;
        break;
      }
      
      visited.add(current.id);
      current = current.next;
    }
    
    if (targetWorkflow) break;  // Stop searching if we found it
  }

  // If we found both the workflow and the state
  if (targetWorkflow && targetState) {
    // If it's a checkbox state, return it directly
    if (targetState.id < 0) {
      log.debug('Found checkbox state', targetState);
      return targetState;
    }
    
    // Otherwise verify the state is still reachable from its workflow head
    let current: WorkflowState | undefined = targetWorkflow;
    const visited = new Set<number>();
    let isReachable = false;
    
    while (current && !visited.has(current.id)) {
      if (current.id === targetState.id) {
        isReachable = true;
        break;
      }
      visited.add(current.id);
      current = current.next;
    }
    
    if (isReachable) {
      log.debug('Found workflow state', targetState);
      return targetState;
    }
  }

  log.debug('No workflow state found for id', id);
  return undefined;
}

/**
 * Generates a short unique ID based on timestamp
 * Format: minutes since midnight (0-1440) + counter (0-99)
 * Results in numbers between 0-144000, which become very short in base36
 */
function generateShortId(): number {
  const date = new Date();
  const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes();
  idCounter = (idCounter + 1) % 100;
  
  return minutesSinceMidnight * 100 + idCounter;
}

/**
 * Encodes a numeric ID to a shorter base36 string
 */
function encodeStateId(id: number): string {
  // For negative IDs (checkbox states), use high numbers
  const shortId = id < 0 ? 900000 + Math.abs(id) : id;
  // Convert to base36 for shortest possible representation
  return shortId.toString(36);
}

/**
 * Decodes a base36 string back to numeric ID
 */
function decodeStateId(encoded: string): number {
  try {
    const num = parseInt(encoded, 36);
    // Convert back high numbers to negative IDs for checkbox states
    return num >= 900000 ? -(num - 900000) : num;
  } catch (e) {
    log.error('Failed to decode state ID', e);
    return -999; // Return unknown state ID on error
  }
}

/**
 * Registers the custom React element renderer for the workflow macro.
 */
function registerWorkflowMacro(): void {
  log.startTimer('register-workflow-macro');
  log.debug('Registering workflow macro renderer');
  
  try {
    logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
      log.startTimer(`macro-render-${slot}`);
      const [type, keyword, encodedId] = payload.arguments;
      
      log.debug('Macro renderer called', { 
        type, 
        keyword, 
        encodedId, 
        slot,
        uuid: payload.uuid
      });
      
      if (type !== "workflow" || !keyword) {
        log.warn('Invalid macro type or missing keyword', { type, keyword });
        log.endTimer(`macro-render-${slot}`);
        return;
      }

      try {
        // If we have an encoded ID, use it directly, otherwise find by keyword
        let targetState: WorkflowState | undefined;
        if (encodedId) {
          const stateId = decodeStateId(encodedId);
          log.debug('Looking up state by ID', { encodedId, decodedId: stateId });
          targetState = findWorkflowStateById(workflowStates, stateId);
        }

        // Fallback to keyword search if no ID or state not found
        if (!targetState) {
          log.debug('State not found by ID, searching by keyword', { keyword });
          for (const workflow of workflowStates) {
            let current: WorkflowState | undefined = workflow;
            const visited = new Set<number>();
            
            while (current && !visited.has(current.id)) {
              if (current.keyword === keyword) {
                targetState = current;
                log.debug('Found state by keyword match', { 
                  id: current.id,
                  keyword: current.keyword
                });
                break;
              }
              
              if (current.hasCheckbox && current.checkboxState?.keyword === keyword) {
                targetState = current.checkboxState;
                log.debug('Found checkbox state by keyword match', { 
                  id: current.checkboxState.id,
                  keyword: current.checkboxState.keyword
                });
                break;
              }
              
              visited.add(current.id);
              current = current.next;
            }
            
            if (targetState) break;
          }
        }

        const block = await logseq.Editor.getBlock(payload.uuid);
        if (!block) {
          log.warn('Block not found for workflow macro', { uuid: payload.uuid });
          return;
        }

        log.debug('Found block for workflow macro', { 
          blockId: block.uuid,
          content: block.content,
          targetState: targetState ? { 
            id: targetState.id, 
            keyword: targetState.keyword,
            hasCheckbox: targetState.hasCheckbox,
            isCircular: targetState.circular
          } : undefined
        });

        const id = `workflow-${slot}`;
        const encodedStateId = targetState ? encodeStateId(targetState.id) : encodeStateId(-999);
        
        log.debug('Setting up workflow macro UI slot', { 
          id, 
          keyword, 
          stateId: targetState?.id, 
          encodedStateId,
          slot
        });

        // Provide a UI slot - now storing the encoded state ID
        logseq.provideUI({
          key: id,
          slot,
          reset: true,
          template: `<div id="${id}" data-state-id="${encodedStateId}" data-keyword="${keyword}" data-block-id="${payload.uuid}"></div>`,
        });

        // Ensure DOM is available
        setTimeout(() => {
          log.startTimer(`setup-macro-${id}`);
          try {
            const rootElement = parent.document.getElementById(id);
            if (rootElement) {
              log.debug('Found root element for macro', { id });
              const reactRoot = ReactDOM.createRoot(rootElement);
              const encodedStateId = rootElement.getAttribute('data-state-id') || encodeStateId(-999);
              const stateId = decodeStateId(encodedStateId);
              const currentWorkflowState = findWorkflowStateById(workflowStates, stateId);

              if (currentWorkflowState) {
                log.debug('Rendering workflow macro', { 
                  id, 
                  stateId, 
                  encodedStateId, 
                  state: {
                    id: currentWorkflowState.id,
                    keyword: currentWorkflowState.keyword,
                    hasCheckbox: currentWorkflowState.hasCheckbox,
                    isCircular: currentWorkflowState.circular
                  }
                });
                
                reactRoot.render(
                  <WorkflowMacro
                    blockId={payload.uuid}
                    initWorkflowState={currentWorkflowState}
                    workflowStates={workflowStates}
                  />
                );
                
                // Store the macro for later re-rendering
                renderedMacros.set(id, { rootElement, reactRoot });
                log.debug('Stored macro reference for re-rendering', { id });
              } else {
                log.warn("Workflow state not found for id", { stateId });
                // Create an "Unknown" state with red color
                const unknownState: WorkflowState = {
                  id: -999,
                  keyword: "✕ Unknown State",
                  color: "#bf3232",
                  next: undefined
                };
                reactRoot.render(
                  <WorkflowMacro
                    blockId={payload.uuid}
                    initWorkflowState={unknownState}
                    workflowStates={workflowStates}
                  />
                );
                // Store the macro for later re-rendering
                renderedMacros.set(id, { rootElement, reactRoot });
                log.debug('Stored unknown state macro reference', { id });
              }
            } else {
              log.error("Root element not found for id", { id });
            }
          } catch (error) {
            log.error('Error setting up macro', { error, id });
          } finally {
            log.endTimer(`setup-macro-${id}`);
          }
        }, 0);
      } catch (error) {
        log.error('Error rendering workflow macro', { error, slot, payload });
      } finally {
        const duration = log.endTimer(`macro-render-${slot}`);
        if (duration > 0) {
          log.perf(`Macro render completed`, { slot, duration });
        }
      }
    });
  } catch (error) {
    log.error('Failed to register workflow macro', error);
    throw error;
  } finally {
    const duration = log.endTimer('register-workflow-macro');
    if (duration > 0) {
      log.perf('Workflow macro registration completed', { duration });
    }
  }
}

/**
 * Opens the workflow query UI in a floating modal.
 */
function openWorkflowQuery(): void {
  log.info('Opening workflow query UI');
  const rootElement = document.getElementById('app');
  if (rootElement) {
    const reactRoot = ReactDOM.createRoot(rootElement);
    reactRoot.render(
      <WorkflowQuery
        key={Date.now()}
        workflowStates={workflowStates}
        onClose={async () => {
          log.info('Closing workflow query UI');
          logseq.hideMainUI();
        }}
      />
    );
  } else {
    log.error("Plugin root element not found");
  }
}

/**
 * Registers slash commands for inserting workflow macros.
 */
async function registerSlashCommands(): Promise<void> {
  log.info('Registering slash commands');

  try {
    // Register a command for each workflow state
    for (const workflow of workflowStates) {
      await logseq.Editor.registerSlashCommand(workflow.keyword, async () => {
        const block = await logseq.Editor.getCurrentBlock();
        if (!block) {
          log.error('No current block found for slash command');
          return;
        }
        
        await logseq.Editor.updateBlock(
          block.uuid,
          `{{renderer workflow, ${workflow.keyword}, ${encodeStateId(workflow.id)}}} ${block.content || ''}`.trim()
        );
      });
    }

    // Register the workflow query command
    await logseq.Editor.registerSlashCommand('Workflow Query', async () => {
      log.info('Workflow query command triggered');
      logseq.showMainUI();
      openWorkflowQuery();
    });

    log.debug('Registered slash commands for workflows:', workflowStates.map(w => w.keyword));
  } catch (error) {
    log.error('Failed to register slash commands', error);
  }
}

/**
 * Loads workflows from the plugin settings.
 */
async function loadWorkflows(): Promise<void> {
  log.startTimer('load-workflows');
  log.debug('Loading workflows from settings');
  
  try {
    const serializedWorkflows = logseq.settings?.serializedWorkflows;
    if (Array.isArray(serializedWorkflows)) {
      log.debug('Found existing workflow states in settings', { 
        count: serializedWorkflows.length,
        workflows: serializedWorkflows.map(w => ({ id: w.id, keyword: w.keyword }))
      });
      
      log.startTimer('deserialize-workflows');
      workflowStates = serializedWorkflows.map(deserializeWorkflow);
      log.endTimer('deserialize-workflows');
      
    } else {
      log.debug('No existing workflow states found, using defaults', { 
        count: DEFAULT_STATES.length,
        states: DEFAULT_STATES.map(s => ({ id: s.id, keyword: s.keyword }))
      });
      workflowStates = [...DEFAULT_STATES];
      
      log.startTimer('serialize-default-workflows');
      const serializedDefaults = workflowStates.map(serializeWorkflow);
      log.endTimer('serialize-default-workflows');
      
      await logseq.updateSettings({
        serializedWorkflows: serializedDefaults
      });
    }
    
    log.startTimer('update-workflow-state');
    await updateWorkflowState();
    log.endTimer('update-workflow-state');
    
  } catch (error) {
    log.error('Failed to load workflows', error);
    throw error;
  } finally {
    log.endTimer('load-workflows');
  }
}

/**
 * Main entry point for the plugin.
 */
const main = async () => {
  log.startTimer('main-initialization');
  
  if (isInitialized) {
    log.warn('Plugin already initialized, skipping');
    return;
  }
  
  log.debug('Initializing workflow plugin', { 
    version: process.env.VERSION || 'unknown',
    environment: process.env.NODE_ENV
  });
  
  isInitialized = true;

  try {
    log.startTimer('load-and-register');
    await loadWorkflows();
    registerWorkflowMacro();
    await registerSlashCommands();
    log.endTimer('load-and-register');

    log.debug('Registering toolbar button');
    await logseq.App.registerUIItem('toolbar', {
      key: 'better-workflow-settings',
      template: `
        <button id="workflow-settings-button" class="button">
          <img src="${settingsIcon}" alt="Settings" style="width: 32px; height: 32px; opacity: 0.8; transition: all 0.2s ease;" 
               onmouseover="this.style.opacity='1'" 
               onmouseout="this.style.opacity='0.8'" />
        </button>
      `,
    });

    parent.document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#workflow-settings-button')) {
        log.debug('Settings button clicked');
        logseq.showMainUI();
        openSettingsPage();
      }
    });

    log.debug("Workflow plugin loaded successfully!");
    logseq.UI.showMsg("Workflow plugin loaded successfully!");
    
  } catch (error) {
    log.error("Error during plugin initialization", { 
      error,
      stack: error instanceof Error ? error.stack : undefined
    });
    logseq.UI.showMsg("Failed to initialize workflow plugin", "error");
  } finally {
    log.endTimer('main-initialization');
  }
};

logseq.ready(main).catch((e) => {
  log.error("Error loading plugin", e);
  logseq.App.showMsg(`Error loading plugin: ${e.message}`, "error");
});
