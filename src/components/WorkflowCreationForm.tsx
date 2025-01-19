import React, { useState } from "react";
import { WorkflowState } from "../types";
import { createLogger } from "../utils/workflowLogger";

// Setup logger
const log = createLogger('WorkflowCreationForm');

interface WorkflowCreationFormProps {
  onAddWorkflow: (workflow: WorkflowState) => void;
  prettyColors: string[];
}

const WorkflowCreationForm: React.FC<WorkflowCreationFormProps> = ({
  onAddWorkflow,
  prettyColors,
}) => {
  const [keyword, setKeyword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    log.debug('Creating new workflow', { keyword });
    const newWorkflow: WorkflowState = {
      id: Date.now(),
      keyword: keyword.trim(),
      color: prettyColors[Math.floor(Math.random() * prettyColors.length)],
      next: undefined,
    };

    onAddWorkflow(newWorkflow);
    setKeyword("");
  };

  return (
    <form onSubmit={handleSubmit} style={{
      marginBottom: "16px",
      background: "rgba(255, 255, 255, 0.03)",
      borderRadius: "8px",
    }}>
      <style>
        {`
          .workflow-input-group {
            display: flex;
            align-items: center;
            background: #141414;
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 6px;
            overflow: hidden;
          }
          .workflow-input {
            flex: 1;
            padding: 8px 12px;
            border: none;
            background: transparent;
            color: #E6E6E6;
            font-size: 13px;
            min-width: 0;
          }
          .workflow-input:focus {
            outline: none;
          }
          .workflow-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
            font-size: 13px;
          }
          .create-button {
            padding: 6px 12px;
            margin: 4px;
            border-radius: 4px;
            border: none;
            background: #2D7FF9;
            color: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
            line-height: 1;
          }
          .create-button:disabled {
            background: rgba(255, 255, 255, 0.06);
            color: rgba(255, 255, 255, 0.3);
            cursor: not-allowed;
          }
          .create-button:not(:disabled):hover {
            background: #1E6FE6;
          }
          .create-button:not(:disabled):active {
            transform: scale(0.98);
          }
          .workflow-input-group:focus-within {
            border-color: rgba(255, 255, 255, 0.1);
            background: #1A1A1A;
          }
        `}
      </style>
      <div className="workflow-input-group">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Enter workflow keyword (e.g., TODO)"
          className="workflow-input"
        />
        <button
          type="submit"
          disabled={!keyword.trim()}
          className="create-button"
        >
          Create
        </button>
      </div>
    </form>
  );
};

export default WorkflowCreationForm; 