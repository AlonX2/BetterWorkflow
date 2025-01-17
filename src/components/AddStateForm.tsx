import React from "react";
import { WorkflowState } from "../types";

// Setup logger with timestamp
const log = {
  info: (msg: string, data?: any) => console.log(`[AddStateForm][${new Date().toISOString()}] INFO: ${msg}`, data ? data : ''),
  error: (msg: string, error?: any) => console.error(`[AddStateForm][${new Date().toISOString()}] ERROR: ${msg}`, error ? error : ''),
  debug: (msg: string, data?: any) => console.debug(`[AddStateForm][${new Date().toISOString()}] DEBUG: ${msg}`, data ? data : '')
};

interface AddStateFormProps {
  newState: WorkflowState;
  onStateChange: (state: WorkflowState) => void;
  onAddState: () => void;
  prettyColors: string[];
}

const AddStateForm: React.FC<AddStateFormProps> = ({
  newState,
  onStateChange,
  onAddState,
}) => {
  log.info('Rendering AddStateForm', { currentState: newState });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    log.debug('Form submitted', { newState });
    onAddState();
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    log.debug('State keyword changed', e.target.value);
    onStateChange({ ...newState, keyword: e.target.value });
  };

  return (
    <>
      <style>
        {`
          .state-form {
            display: flex;
            margin-top: 10px;
            padding: 4px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
          }
          .state-input-group {
            display: flex;
            flex: 1;
            align-items: center;
            background: #141414;
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 6px;
            overflow: hidden;
          }
          .state-input {
            flex: 1;
            padding: 8px 12px;
            border: none;
            background: transparent;
            color: #E6E6E6;
            font-size: 13px;
            min-width: 0;
          }
          .state-input:focus {
            outline: none;
          }
          .state-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
            font-size: 13px;
          }
          .add-state-btn {
            padding: 6px 12px;
            margin: 4px;
            border-radius: 4px;
            border: none;
            background-color: #2D7FF9;
            color: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
            line-height: 1;
          }
          .add-state-btn:hover {
            background-color: #1E6FE6;
          }
          .add-state-btn:active {
            transform: scale(0.98);
          }
          .state-input-group:focus-within {
            border-color: rgba(255, 255, 255, 0.1);
            background: #1A1A1A;
          }
        `}
      </style>
      <form 
        onSubmit={handleSubmit}
        className="state-form"
      >
        <div className="state-input-group">
          <input
            className="state-input"
            type="text"
            placeholder="Type keyword and press Enter"
            value={newState.keyword}
            onChange={handleStateChange}
            autoFocus
          />
          <button
            className="add-state-btn"
            type="submit"
          >
            Add
          </button>
        </div>
      </form>
    </>
  );
};

export default AddStateForm; 