window.tokenAuditData = {
  "schema": "memo-ray.token-audit/gemini",
  "generatedAt": "2026-06-25T11:15:46.943Z",
  "methodology": {
    "counter": "offline-approx (@anthropic-ai/tokenizer, legacy Claude BPE)",
    "exact": false,
    "offlineCaveat": "Counts from a legacy Claude BPE tokenizer running locally (no key/spend). Approximate for current models; re-run with ANTHROPIC_API_KEY for exact count_tokens numbers.",
    "outputTokens": "not measured — no model call is made; this audit measures input/context tokens only",
    "headlineExcludes": "worst-case (strawman) baselines are reported but excluded from the headline savings",
    "injectedConstants": "none — v1 additive overhead removed"
  },
  "headline": {
    "counter": "offline-approx (@anthropic-ai/tokenizer, legacy Claude BPE)",
    "fairScenarioCount": 3,
    "totalNoMcpInputTokens": 149818,
    "totalMcpInputTokens": 88962,
    "savingsInputTokens": 60856,
    "savingsPercent": 40.62
  },
  "summary": [
    {
      "name": "Get Latest Session",
      "baseline": "fair",
      "runs": 3,
      "noMcpInputTokens": 3104,
      "mcpInputTokens": 309,
      "savingsInputTokens": 2795,
      "savingsPercent": 90.05,
      "mcpWins": true
    },
    {
      "name": "Reconstruct Session Timeline",
      "baseline": "fair",
      "runs": 3,
      "noMcpInputTokens": 73357,
      "mcpInputTokens": 70886,
      "savingsInputTokens": 2471,
      "savingsPercent": 3.37,
      "mcpWins": true
    },
    {
      "name": "Query Sessions by Project",
      "baseline": "worst-case",
      "runs": 1,
      "noMcpInputTokens": 28848,
      "mcpInputTokens": 1724,
      "savingsInputTokens": 27124,
      "savingsPercent": 94.02,
      "mcpWins": true
    },
    {
      "name": "Sliding Window Timeline (last 50)",
      "baseline": "fair",
      "runs": 3,
      "noMcpInputTokens": 73357,
      "mcpInputTokens": 17767,
      "savingsInputTokens": 55590,
      "savingsPercent": 75.78,
      "mcpWins": true
    }
  ],
  "scenarios": [
    {
      "testId": 1,
      "name": "Get Latest Session",
      "baseline": "fair",
      "note": "Reasonable agent reads the index + one session entity; MCP returns one structured summary.",
      "noMcp": {
        "inputTokens": 3169,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 309,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 2860,
        "inputPercent": 90.25
      },
      "mcpWins": true,
      "target": "2047a2249388f7e96c1dfadadbeee30b"
    },
    {
      "testId": 1,
      "name": "Get Latest Session",
      "baseline": "fair",
      "note": "Reasonable agent reads the index + one session entity; MCP returns one structured summary.",
      "noMcp": {
        "inputTokens": 3042,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 309,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 2733,
        "inputPercent": 89.84
      },
      "mcpWins": true,
      "target": "a317ea0fee4c56cfbab2d2a97b815050"
    },
    {
      "testId": 1,
      "name": "Get Latest Session",
      "baseline": "fair",
      "note": "Reasonable agent reads the index + one session entity; MCP returns one structured summary.",
      "noMcp": {
        "inputTokens": 3100,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 309,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 2791,
        "inputPercent": 90.03
      },
      "mcpWins": true,
      "target": "6538f68ec2acc6e7b99710b41ead79e4"
    },
    {
      "testId": 2,
      "name": "Reconstruct Session Timeline",
      "baseline": "fair",
      "note": "Both arms need the entire timeline. This is the control case where the MCP layer cannot compress — watch for ~0 or negative savings.",
      "noMcp": {
        "inputTokens": 148740,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 146664,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 2076,
        "inputPercent": 1.4
      },
      "mcpWins": true,
      "target": "2047a2249388f7e96c1dfadadbeee30b"
    },
    {
      "testId": 2,
      "name": "Reconstruct Session Timeline",
      "baseline": "fair",
      "note": "Both arms need the entire timeline. This is the control case where the MCP layer cannot compress — watch for ~0 or negative savings.",
      "noMcp": {
        "inputTokens": 15837,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 13047,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 2790,
        "inputPercent": 17.62
      },
      "mcpWins": true,
      "target": "a317ea0fee4c56cfbab2d2a97b815050"
    },
    {
      "testId": 2,
      "name": "Reconstruct Session Timeline",
      "baseline": "fair",
      "note": "Both arms need the entire timeline. This is the control case where the MCP layer cannot compress — watch for ~0 or negative savings.",
      "noMcp": {
        "inputTokens": 55495,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 52947,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 2548,
        "inputPercent": 4.59
      },
      "mcpWins": true,
      "target": "6538f68ec2acc6e7b99710b41ead79e4"
    },
    {
      "testId": 3,
      "name": "Query Sessions by Project",
      "baseline": "worst-case",
      "note": "No-MCP arm loads every session entity to filter by project — a strawman; a real agent would grep. Treat the headline number with caution.",
      "noMcp": {
        "inputTokens": 28848,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 1724,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 27124,
        "inputPercent": 94.02
      },
      "mcpWins": true
    },
    {
      "testId": 4,
      "name": "Sliding Window Timeline (last 50)",
      "baseline": "fair",
      "note": "No-MCP arm must load the full tree to slice the tail; MCP returns exactly the window.",
      "noMcp": {
        "inputTokens": 148740,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 21362,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 127378,
        "inputPercent": 85.64
      },
      "mcpWins": true,
      "target": "2047a2249388f7e96c1dfadadbeee30b"
    },
    {
      "testId": 4,
      "name": "Sliding Window Timeline (last 50)",
      "baseline": "fair",
      "note": "No-MCP arm must load the full tree to slice the tail; MCP returns exactly the window.",
      "noMcp": {
        "inputTokens": 15837,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 13082,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 2755,
        "inputPercent": 17.4
      },
      "mcpWins": true,
      "target": "a317ea0fee4c56cfbab2d2a97b815050"
    },
    {
      "testId": 4,
      "name": "Sliding Window Timeline (last 50)",
      "baseline": "fair",
      "note": "No-MCP arm must load the full tree to slice the tail; MCP returns exactly the window.",
      "noMcp": {
        "inputTokens": 55495,
        "outputTokens": null
      },
      "mcp": {
        "inputTokens": 18857,
        "outputTokens": null
      },
      "savings": {
        "inputTokens": 36638,
        "inputPercent": 66.02
      },
      "mcpWins": true,
      "target": "6538f68ec2acc6e7b99710b41ead79e4"
    }
  ]
};