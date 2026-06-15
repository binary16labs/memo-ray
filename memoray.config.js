const path = require('path');
const os = require('os');

// ============================================================================
// MEMO-RAY MANIFEST & CONTRACT
// ============================================================================
// This is the single source of truth for where Memo-Ray looks for agent data. 
// If you move your IDE, reinstall Claude, or share this with someone on a Mac, 
// update the paths here.
//
// ADHD / Dyslexia Note: 
// Everything is in one place. You don't need to hunt through the server code.
// ============================================================================

const home = os.homedir();
const isWin = os.platform() === 'win32';

module.exports = {
    // ------------------------------------------------------------------------
    // CLAUDE CODE CONFIGURATION
    // ------------------------------------------------------------------------
    
    // Directory where Claude Code stores active session PIDs (for Live Status)
    CLAUDE_SESSIONS_DIR: path.join(home, '.claude', 'sessions'),
    
    // Directories where Claude Code stores the actual conversational logs (.jsonl)
    CLAUDE_LOG_DIRS: [
        path.join(home, '.claude', 'projects'),                                 // Mac/Linux default
        path.join(home, 'AppData', 'Roaming', 'Claude', 'projects'),            // Windows default
        path.join(home, 'AppData', 'Roaming', 'Claude', 'local-agent-mode-sessions'),
        path.join(home, 'AppData', 'Roaming', 'Claude', 'claude-code-sessions'),
        path.join(home, 'Library', 'Application Support', 'Claude', 'projects'), // Mac alternative
        path.join(home, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions'),
        path.join(home, 'Library', 'Application Support', 'Claude', 'claude-code-sessions')
    ],
    
    // Path to the file that tracks Git Worktrees created by Claude Code
    CLAUDE_WORKTREES_PATH: isWin 
        ? path.join(home, 'AppData', 'Roaming', 'Claude', 'git-worktrees.json')
        : path.join(home, 'Library', 'Application Support', 'Claude', 'git-worktrees.json'),
        
    // Path to the Claude Desktop application configuration (for tool discovery)
    CLAUDE_CONFIG_PATH: isWin
        ? path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
        : path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),


    // ------------------------------------------------------------------------
    // ANTIGRAVITY (GEMINI) CONFIGURATION
    // ------------------------------------------------------------------------
    
    // Directories where Antigravity stores its conversation trajectories (.jsonl)
    // We scan both the default CLI location and the IDE location.
    ANTIGRAVITY_BRAIN_DIRS: [
        path.join(home, '.gemini', 'antigravity', 'brain'),
        path.join(home, '.gemini', 'antigravity-ide', 'brain')
    ],

    // Directory for Gemini Agent plugins and core configuration
    GEMINI_CONFIG_DIR: path.join(home, '.gemini', 'config')
};
