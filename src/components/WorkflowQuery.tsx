import React, { useState } from 'react';
import { WorkflowState } from '../types';

interface WorkflowQueryProps {
  workflowStates: WorkflowState[];
  onClose: () => void;
}

const WorkflowQuery: React.FC<WorkflowQueryProps> = ({
  workflowStates,
  onClose,
}) => {
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [queryTitle, setQueryTitle] = useState('');

  // Get all unique state keywords
  const allStates = new Set<string>();
  workflowStates.forEach(workflow => {
    let current: WorkflowState | undefined = workflow;
    const visited = new Set<number>();
    while (current && !visited.has(current.id)) {
      allStates.add(current.keyword);
      // Add checkbox state if it exists
      if (current.hasCheckbox && current.checkboxState) {
        allStates.add(current.checkboxState.keyword);
      }
      visited.add(current.id);
      current = current.next;
    }
  });

  const handleStateToggle = (keyword: string) => {
    setSelectedStates(prev => 
      prev.includes(keyword) 
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const generateQuery = () => {
    if (selectedStates.length === 0) return '';

    return `#+BEGIN_QUERY
{
  :title ${queryTitle ? `[:h2 "${queryTitle}"]` : '""'}
  :query [:find (pull ?b [*])
          :where
          [?b :block/content ?content]
          [(clojure.string/includes? ?content "#+BEGIN_QUERY") ?query]
          [(not ?query)]
          (or
            ${selectedStates
              .map(state => `[(clojure.string/includes? ?content "{{renderer workflow, ${state.replace(/[:.]/g, "\\\\$&")},")]`)
              .join('\n            ')})]
}
#+END_QUERY`;
  };

  const handleSubmit = async () => {
    const query = generateQuery();
    if (query) {
      const block = await logseq.Editor.getCurrentBlock();
      if (block) {
        await logseq.Editor.updateBlock(block.uuid, query);
      }
    }
    onClose();
  };

  return (
    <div style={{
      padding: "24px",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: "#1A1A1A",
      borderRadius: "12px",
      maxWidth: "400px",
      width: "95%",
      margin: "0 auto",
      boxShadow: "0 4px 40px rgba(0, 0, 0, 0.4)",
      color: "#E6E6E6",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      position: "fixed",
      left: "50%",
      top: "40px",
      transform: "translateX(-50%)",
      zIndex: 9999,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        marginBottom: "16px",
        justifyContent: "space-between"
      }}>
        <h2 style={{
          margin: 0,
          fontSize: "18px",
          fontWeight: "500",
          color: "#FFFFFF",
          letterSpacing: "-0.01em",
        }}>Create Workflow Query</h2>
        <button 
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#999",
            fontSize: "18px",
            cursor: "pointer",
            padding: "8px",
            borderRadius: "6px",
            transition: "all 0.2s ease",
            lineHeight: 1,
          }}
        >✕</button>
      </div>

      <div style={{
        marginBottom: "20px",
      }}>
        <div style={{
          fontSize: "14px",
          color: "#999",
          marginBottom: "8px",
        }}>Query title (optional):</div>
        <input
          type="text"
          value={queryTitle}
          onChange={(e) => setQueryTitle(e.target.value)}
          placeholder="Enter query title"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "#2d2d44",
            color: "#E6E6E6",
            fontSize: "13px",
            marginBottom: "20px",
            boxSizing: "border-box",
          }}
        />

        <div style={{
          fontSize: "14px",
          color: "#999",
          marginBottom: "8px",
        }}>Select workflow states to include in the query:</div>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          maxHeight: "200px",
          overflowY: "auto",
          padding: "4px",
        }}>
          {Array.from(allStates).map(state => (
            <button
              key={state}
              onClick={() => handleStateToggle(state)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: selectedStates.includes(state) ? "#3182CE20" : "#2d2d44",
                color: selectedStates.includes(state) ? "#3182CE" : "#9BA3AF",
                cursor: "pointer",
                fontSize: "13px",
                transition: "all 0.2s ease",
              }}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "8px",
      }}>
        <button
          onClick={handleSubmit}
          disabled={selectedStates.length === 0}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: selectedStates.length === 0 ? "#2d2d44" : "#0066FF",
            color: selectedStates.length === 0 ? "#666" : "white",
            cursor: selectedStates.length === 0 ? "not-allowed" : "pointer",
            fontSize: "14px",
            transition: "all 0.2s ease",
          }}
        >
          Create Query
        </button>
      </div>
    </div>
  );
};

export default WorkflowQuery; 