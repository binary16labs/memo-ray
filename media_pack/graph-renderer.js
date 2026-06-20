/**
 * MemoRayGraph — Standalone canvas graph renderer
 * Extracted from OrganicGraph.jsx's paintNode logic for use without React.
 * Renders force-directed session graphs with Memo-Ray's native palette.
 */

const PALETTE = {
  'User Input': '#b8a898',
  'Thought':    '#8b9c8b',
  'Message':    '#8b9c8b',
  'Tool Call':  '#6a8a6a',
  'Tool Result':'#6a8a6a',
  'Artifact':   '#8a9aa4',
  'Session':    '#c4a882',
  'System Init':'#5a6a5e',
  'Error':      '#c47a6a',
};

class MemoRayGraph {
  constructor(canvas, graphData, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = graphData.nodes || [];
    this.links = graphData.links || [];
    this.options = {
      bgColor: options.bgColor || '#121614',
      highlightColor: options.highlightColor || '#db533f',
      linkColor: options.linkColor || 'rgba(138,154,164,0.12)',
      animateOnLoad: options.animateOnLoad !== false,
      ...options
    };

    // State
    this.highlightId = null;
    this.breadcrumbs = [];
    this.hoveredNode = null;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.dragging = false;
    this.lastMouse = null;
    this.playbackIndex = 0;
    this.playing = false;
    this.playTimer = null;
    this.baseIntervalMs = 400;
    this.speedMultiplier = 1;
    this.currentStats = { steps: 0, thoughts: 0, toolCalls: 0, tokens: 0 };

    // Sort nodes chronologically and assign initial positions
    this.nodes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Build adjacency map
    this.childMap = {};
    this.parentMap = {};
    for (const link of this.links) {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      if (!this.childMap[src]) this.childMap[src] = [];
      this.childMap[src].push(tgt);
      this.parentMap[tgt] = src;
    }

    // Node map for quick lookup
    this.nodeMap = {};
    this.nodes.forEach(n => { this.nodeMap[n.id] = n; });

    this._initPositions();
    this._bindEvents();
    this._startSimulation();

    // Callbacks
    this.onBreadcrumbChange = options.onBreadcrumbChange || null;
    this.onNodeSelect = options.onNodeSelect || null;
    this.onPlaybackStatsChange = options.onPlaybackStatsChange || null;
  }

  _initPositions() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const lanes = {
      'User Input': -2, 'Session': 0, 'Thought': 1, 'Message': 1,
      'Tool Call': 2, 'Tool Result': 3, 'Artifact': -1, 'Error': 4, 'System Init': 0,
    };

    this.nodes.forEach((n, i) => {
      n.x = (i - this.nodes.length / 2) * 60 + w / 2;
      n.y = (lanes[n.type] || 0) * 50 + h / 2;
      n.vx = 0;
      n.vy = 0;
    });
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousemove', (e) => {
      const rect = c.getBoundingClientRect();
      const mx = (e.clientX - rect.left - this.panX) / this.zoom;
      const my = (e.clientY - rect.top - this.panY) / this.zoom;
      this.hoveredNode = this._findNodeAt(mx, my);
      c.style.cursor = this.hoveredNode ? 'pointer' : (this.dragging ? 'grabbing' : 'grab');
      this._draw();
    });

    c.addEventListener('click', (e) => {
      if (this.hoveredNode) {
        this.selectNode(this.hoveredNode.id);
      }
    });

    c.addEventListener('mousedown', (e) => {
      if (!this.hoveredNode) {
        this.dragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    c.addEventListener('mouseup', () => { this.dragging = false; });

    c.addEventListener('mouseleave', () => {
      this.dragging = false;
      this.hoveredNode = null;
    });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.1, Math.min(5, this.zoom * delta));
      this._draw();
    }, { passive: false });

    window.addEventListener('mousemove', (e) => {
      if (this.dragging && this.lastMouse) {
        this.panX += e.clientX - this.lastMouse.x;
        this.panY += e.clientY - this.lastMouse.y;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this._draw();
      }
    });
  }

  _findNodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const r = (n.val || 6) * 1.5;
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy < r * r) return n;
    }
    return null;
  }

  _startSimulation() {
    // Simple spring-based force simulation
    let iterations = 0;
    const maxIter = 200;

    const tick = () => {
      if (iterations > maxIter) {
        this._draw();
        return;
      }
      iterations++;

      // Repulsion between all nodes (Barnes–Hut simplified)
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const a = this.nodes[i], b = this.nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = -300 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Spring attraction along links
      for (const link of this.links) {
        const src = this.nodeMap[typeof link.source === 'object' ? link.source.id : link.source];
        const tgt = this.nodeMap[typeof link.target === 'object' ? link.target.id : link.target];
        if (!src || !tgt) continue;
        let dx = tgt.x - src.x, dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 50) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        src.vx += fx; src.vy += fy;
        tgt.vx -= fx; tgt.vy -= fy;
      }

      // Apply velocities with damping
      for (const n of this.nodes) {
        n.vx *= 0.75;
        n.vy *= 0.75;
        n.x += n.vx;
        n.y += n.vy;
      }

      this._draw();
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.options.bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Draw links
    for (const link of this.links) {
      const src = this.nodeMap[typeof link.source === 'object' ? link.source.id : link.source];
      const tgt = this.nodeMap[typeof link.target === 'object' ? link.target.id : link.target];
      if (!src || !tgt) continue;

      const isHighlightedLink =
        (this.highlightId === src.id || this.highlightId === tgt.id);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = isHighlightedLink
        ? 'rgba(219, 83, 63, 0.6)'
        : this.options.linkColor;
      ctx.lineWidth = isHighlightedLink ? 2 : 0.5;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of this.nodes) {
      this._paintNode(node, ctx);
    }

    ctx.restore();

    // Draw tooltip for hovered node
    if (this.hoveredNode) {
      this._drawTooltip(this.hoveredNode);
    }
  }

  _paintNode(node, ctx) {
    const isHighlighted = node.id === this.highlightId;
    const isHovered = this.hoveredNode && node.id === this.hoveredNode.id;
    const color = isHighlighted ? this.options.highlightColor : (PALETTE[node.type] || '#5a6a5e');
    const size = (node.val || 6) * (isHighlighted ? 2.0 : isHovered ? 1.5 : 1);

    ctx.save();

    // Glow
    if (isHighlighted || node.type === 'Session') {
      ctx.shadowColor = isHighlighted ? this.options.highlightColor : color;
      ctx.shadowBlur = isHighlighted ? 24 : 8;
    }

    ctx.beginPath();
    if (node.type === 'Artifact') {
      // Rounded rect
      const r = size * 0.4, x = node.x - size, y = node.y - size, w = size * 2, h = size * 2;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    } else {
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    }

    ctx.fillStyle = color;
    ctx.globalAlpha = isHighlighted ? 1.0 : 0.85;
    ctx.fill();

    // Membrane
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(size * 0.12, 0.5);
    ctx.strokeStyle = isHighlighted ? 'rgba(255,255,255,0.9)' : 'rgba(232,236,233,0.15)';
    ctx.stroke();

    ctx.restore();

    // Pulse ring for highlighted
    if (isHighlighted) {
      ctx.save();
      const pulse = Math.sin(Date.now() / 250) * 0.5 + 0.5;
      const pulseR = size * (1.2 + pulse * 0.5);
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseR, 0, 2 * Math.PI);
      ctx.strokeStyle = this.options.highlightColor;
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.globalAlpha = 0.6 - pulse * 0.45;
      ctx.stroke();
      ctx.restore();
    }

    // Label
    if (this.zoom > 0.8 || isHighlighted || isHovered) {
      const fontSize = Math.max(10 / this.zoom, 5);
      ctx.font = isHighlighted ? `bold ${fontSize + 1}px Inter, system-ui` : `500 ${fontSize}px Inter, system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHighlighted ? this.options.highlightColor : 'rgba(232,236,233,0.7)';
      const maxChars = 24;
      const text = (node.label || node.type).length > maxChars
        ? (node.label || node.type).substring(0, maxChars) + '…'
        : (node.label || node.type);
      ctx.fillText(text, node.x, node.y + size + 3);
    }
  }

  _drawTooltip(node) {
    const ctx = this.ctx;
    const text = [
      `Type: ${node.type}`,
      `Agent: ${node.agent}`,
      `Tokens: ${node.tokens}`,
      `Size: ${node.sizeBytes} bytes`
    ];
    const padding = 10;
    const lineH = 16;
    const w = 200;
    const h = text.length * lineH + padding * 2;
    const x = this.canvas.width - w - 16;
    const y = 16;

    ctx.fillStyle = 'rgba(15, 17, 16, 0.95)';
    ctx.strokeStyle = 'rgba(149, 165, 149, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = '12px Inter, system-ui';
    ctx.fillStyle = '#e8ece9';
    text.forEach((line, i) => {
      ctx.fillText(line, x + padding, y + padding + i * lineH);
    });
  }

  // Public API
  selectNode(id) {
    this.highlightId = id;
    const node = this.nodeMap[id];
    if (node) {
      // Build breadcrumb trail
      this.breadcrumbs = [];
      let current = node;
      while (current) {
        this.breadcrumbs.unshift({ id: current.id, type: current.type, label: (current.label || '').substring(0, 40) });
        current = this.parentMap[current.id] ? this.nodeMap[this.parentMap[current.id]] : null;
      }
      if (this.onBreadcrumbChange) this.onBreadcrumbChange(this.breadcrumbs);
      if (this.onNodeSelect) this.onNodeSelect(node);
      
      // Update stats based on chronological position of selected node
      const chronIndex = this.nodes.findIndex(n => n.id === id);
      if (chronIndex >= 0 && !this.playing) {
        this.playbackIndex = chronIndex;
        this._recalculateStatsUpTo(chronIndex);
        if (this.onPlaybackStatsChange) this.onPlaybackStatsChange(this.currentStats);
      }
    }
    this._draw();
  }

  _recalculateStatsUpTo(index) {
    this.currentStats = { steps: 0, thoughts: 0, toolCalls: 0, tokens: 0 };
    for (let i = 0; i <= index; i++) {
      const n = this.nodes[i];
      if (!n) continue;
      this.currentStats.steps++;
      this.currentStats.tokens += n.tokens || 0;
      if (n.type === 'Thought') this.currentStats.thoughts++;
      if (n.type === 'Tool Call') this.currentStats.toolCalls++;
    }
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
    if (this.playing) {
      // Restart loop with new speed
      this.stop();
      this.play();
    }
  }

  play() {
    this.playing = true;
    if (this.playbackIndex >= this.nodes.length) {
      this.playbackIndex = 0;
      this.currentStats = { steps: 0, thoughts: 0, toolCalls: 0, tokens: 0 };
    }
    
    const interval = Math.max(20, this.baseIntervalMs / this.speedMultiplier);
    
    this.playTimer = setInterval(() => {
      if (this.playbackIndex >= this.nodes.length) {
        this.stop();
        return;
      }
      
      const node = this.nodes[this.playbackIndex];
      this.currentStats.steps++;
      this.currentStats.tokens += node.tokens || 0;
      if (node.type === 'Thought') this.currentStats.thoughts++;
      if (node.type === 'Tool Call') this.currentStats.toolCalls++;
      
      // Internal call so we don't trigger the recalculate loop
      this.highlightId = node.id;
      if (this.onNodeSelect) this.onNodeSelect(node);
      
      if (this.onPlaybackStatsChange) {
        this.onPlaybackStatsChange(this.currentStats);
      }
      
      this._draw();
      this.playbackIndex++;
    }, interval);
  }

  stop() {
    this.playing = false;
    if (this.playTimer) clearInterval(this.playTimer);
    this.playTimer = null;
  }

  zoomToFit() {
    if (this.nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const gw = (maxX - minX) || 1, gh = (maxY - minY) || 1;
    this.zoom = Math.min(this.canvas.width / (gw + 100), this.canvas.height / (gh + 100));
    this.panX = this.canvas.width / 2 - ((minX + maxX) / 2) * this.zoom;
    this.panY = this.canvas.height / 2 - ((minY + maxY) / 2) * this.zoom;
    this._draw();
  }
}

// Export for both module and script contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoRayGraph;
} else if (typeof window !== 'undefined') {
  window.MemoRayGraph = MemoRayGraph;
}
