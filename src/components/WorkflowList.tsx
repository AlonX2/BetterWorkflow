import React, { useState } from "react";
import { WorkflowState } from "../types";
import WorkflowChain from "./WorkflowChain";
import AddStateForm from "./AddStateForm";
import { createLogger } from "../utils/workflowLogger";

// Setup logger
const log = createLogger('WorkflowList');

interface WorkflowListProps {
  workflows: WorkflowState[];
  selectedWorkflow: number | null;
  newState: WorkflowState;
  onStateChange: (state: WorkflowState) => void;
  onNewStateChange: (state: WorkflowState) => void;
  onAddStateToWorkflow: (workflowId: number) => void;
  onSelectWorkflow: (workflowId: number | null) => void;
  onCircularChange: (workflowId: number, isCircular: boolean) => void;
  onCheckboxChange: (workflowId: number, hasCheckbox: boolean, checkboxState?: WorkflowState) => void;
  onDeleteWorkflow: (workflow: WorkflowState) => void;
  onDeleteState: (state: WorkflowState) => void;
  prettyColors: string[];
}

const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  selectedWorkflow,
  newState,
  onStateChange,
  onNewStateChange,
  onAddStateToWorkflow,
  onSelectWorkflow,
  onCircularChange,
  onCheckboxChange,
  onDeleteWorkflow,
  onDeleteState,
  prettyColors,
}) => {
  log.debug('Rendering WorkflowList', { workflowCount: workflows.length });

  const handleWorkflowSelect = (workflowId: number) => {
    log.debug('Workflow selected', workflowId);
    onSelectWorkflow(selectedWorkflow === workflowId ? null : workflowId);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      <style>
        {`
          .workflow-item {
            background-color: #242424;
            border-radius: 8px;
            padding: 12px;
            transition: all 0.2s ease;
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          .workflow-item:hover {
            border-color: rgba(255, 255, 255, 0.15);
            background-color: #262626;
          }
          .workflow-button {
            padding: 6px 10px;
            border-radius: 6px;
            border: none;
            background-color: rgba(255, 255, 255, 0.06);
            color: #E6E6E6;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .workflow-button:hover {
            background-color: rgba(255, 255, 255, 0.1);
          }
          .delete-button {
            padding: 6px 10px;
            border-radius: 6px;
            border: none;
            background-color: rgba(255, 59, 59, 0.08);
            color: #ff5f5f;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .delete-button:hover {
            background-color: rgba(255, 59, 59, 0.12);
          }
          .workflow-actions {
            display: flex;
            gap: 6px;
            position: absolute;
            right: 12px;
            top: 12px;
            z-index: 5;
          }
        `}
      </style>
      {workflows.map((workflow) => {
        log.debug('Rendering workflow item', { workflowId: workflow.id, keyword: workflow.keyword });
        return (
          <div
            key={workflow.id}
            className="workflow-item"
            style={{ position: 'relative' }}
          >
            <div className="workflow-actions">
              <button
                onClick={() => handleWorkflowSelect(workflow.id)}
                className="workflow-button"
              >
                + Add
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWorkflow(workflow);
                }}
                className="delete-button"
              >
                Delete
              </button>
            </div>

            <WorkflowChain
              workflow={workflow}
              onCircularChange={(isCircular) => onCircularChange(workflow.id, isCircular)}
              onCheckboxChange={(hasCheckbox, checkboxState) => onCheckboxChange(workflow.id, hasCheckbox, checkboxState)}
              onDeleteState={(state) => onDeleteState({ ...state, parentId: workflow.id })}
              onColorChange={(state, newColor) => {
                log.debug('Color change in workflow chain', { state, newColor });
                onStateChange({ ...state, color: newColor });
              }}
              prettyColors={prettyColors}
            />

            {selectedWorkflow === workflow.id && (
              <AddStateForm
                newState={newState}
                onStateChange={onNewStateChange}
                onAddState={() => onAddStateToWorkflow(workflow.id)}
                prettyColors={prettyColors}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowList; 