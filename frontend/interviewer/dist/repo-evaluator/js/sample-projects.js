/**
 * Sample projects ready to be loaded into Momentum VS Code Web IDE
 */
window.SAMPLE_PROJECTS = {
  "web-game": {
    name: "Cyberpunk Neon Runner (HTML5 Game)",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neon Runner 2088</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <div class="hud">
      <div class="hud-item">SCORE: <span id="score">0</span></div>
      <div class="hud-item">MULTIPLIER: <span id="mult">x1</span></div>
      <div class="hud-item">SHIELD: <span id="shield">100%</span></div>
    </div>
    <canvas id="gameCanvas" width="800" height="400"></canvas>
    <div id="overlay" class="overlay">
      <h1 class="glow-text">NEON RUNNER</h1>
      <p>Press <span class="key">SPACE</span> or <span class="key">UP</span> to Jump</p>
      <button id="start-btn">ENGAGE RUNNER</button>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>`,
      "style.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #0a0a14;
  color: #fff;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  overflow: hidden;
}

#game-container {
  position: relative;
  width: 800px;
  height: 400px;
  border: 2px solid #00f3ff;
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(255, 0, 128, 0.2);
  background: #080811;
  overflow: hidden;
}

.hud {
  position: absolute;
  top: 16px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 2px;
  text-shadow: 0 0 8px #00f3ff;
  z-index: 10;
}

.hud-item span {
  color: #00f3ff;
}

canvas {
  display: block;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 10, 20, 0.88);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
  z-index: 20;
  transition: opacity 0.3s;
}

.overlay.hidden {
  opacity: 0;
  pointer-events: none;
}

.glow-text {
  font-size: 42px;
  letter-spacing: 6px;
  color: #ff007f;
  text-shadow: 0 0 20px #ff007f, 0 0 40px #ff007f;
}

p {
  color: #a0a5cc;
  font-size: 15px;
}

.key {
  display: inline-block;
  padding: 2px 8px;
  background: #1b1b36;
  border: 1px solid #00f3ff;
  border-radius: 4px;
  color: #00f3ff;
  font-family: monospace;
}

button {
  margin-top: 10px;
  padding: 12px 28px;
  background: linear-gradient(135deg, #ff007f, #7928ca);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
  transition: all 0.2s;
}

button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(255, 0, 128, 0.8);
}`,
      "game.js": `const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const multEl = document.getElementById('mult');
const shieldEl = document.getElementById('shield');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

let isRunning = false;
let score = 0;
let multiplier = 1;
let shield = 100;
let frame = 0;

const player = {
  x: 80,
  y: 300,
  width: 30,
  height: 44,
  vy: 0,
  gravity: 0.8,
  jumpPower: -14,
  grounded: true,
  trail: []
};

let obstacles = [];
let particles = [];
let stars = [];

for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * (canvas.height - 80),
    speed: 0.5 + Math.random() * 2,
    size: Math.random() * 2
  });
}

function spawnObstacle() {
  const height = 30 + Math.random() * 35;
  obstacles.push({
    x: canvas.width + 20,
    y: 344 - height,
    width: 24,
    height: height,
    speed: 6 + Math.min(score / 500, 6)
  });
}

function jump() {
  if (player.grounded) {
    player.vy = player.jumpPower;
    player.grounded = false;
    createSparks(player.x + 15, player.y + 44, '#00f3ff');
  }
}

function createSparks(x, y, color) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 20,
      color
    });
  }
}

function update() {
  if (!isRunning) return;
  frame++;
  score += 1 * multiplier;
  scoreEl.textContent = score;

  // Stars
  stars.forEach(s => {
    s.x -= s.speed;
    if (s.x < 0) s.x = canvas.width;
  });

  // Player physics
  player.vy += player.gravity;
  player.y += player.vy;
  if (player.y >= 300) {
    player.y = 300;
    player.vy = 0;
    player.grounded = true;
  }

  // Player trail
  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 8) player.trail.shift();

  // Spawning obstacles
  if (frame % Math.max(50, 100 - Math.floor(score / 200)) === 0) {
    spawnObstacle();
  }

  // Update obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.x -= ob.speed;

    // Collision
    if (
      player.x < ob.x + ob.width &&
      player.x + player.width > ob.x &&
      player.y < ob.y + ob.height &&
      player.y + player.height > ob.y
    ) {
      shield -= 35;
      shieldEl.textContent = Math.max(0, shield) + '%';
      createSparks(player.x + 15, player.y + 20, '#ff0055');
      obstacles.splice(i, 1);
      if (shield <= 0) {
        gameOver();
        return;
      }
      continue;
    }

    if (ob.x + ob.width < 0) {
      obstacles.splice(i, 1);
      if (score % 200 === 0) {
        multiplier++;
        multEl.textContent = 'x' + multiplier;
      }
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  draw();
  requestAnimationFrame(update);
}

function draw() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Background stars
  stars.forEach(s => {
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (s.size / 2) + ')';
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });

  // Neon Grid Ground
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 344);
  ctx.lineTo(canvas.width, 344);
  ctx.stroke();

  // Trail
  player.trail.forEach((t, i) => {
    ctx.fillStyle = 'rgba(0, 243, 255, ' + (i / 10) * 0.4 + ')';
    ctx.fillRect(t.x, t.y, player.width, player.height);
  });

  // Player Box
  ctx.fillStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 15;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.shadowBlur = 0;

  // Obstacles
  obstacles.forEach(ob => {
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 12;
    ctx.fillRect(ob.x, ob.y, ob.width, ob.height);
    ctx.shadowBlur = 0;
  });

  // Particles
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  });
}

function startGame() {
  score = 0;
  multiplier = 1;
  shield = 100;
  scoreEl.textContent = '0';
  multEl.textContent = 'x1';
  shieldEl.textContent = '100%';
  obstacles = [];
  particles = [];
  player.y = 300;
  player.vy = 0;
  isRunning = true;
  overlay.classList.add('hidden');
  requestAnimationFrame(update);
}

function gameOver() {
  isRunning = false;
  overlay.classList.remove('hidden');
  overlay.querySelector('h1').textContent = 'GAME OVER';
  startBtn.textContent = 'PLAY AGAIN (SCORE: ' + score + ')';
}

startBtn.addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (!isRunning) startGame();
    else jump();
  }
});

draw();
`
    }
  },
  "python-algorithms": {
    name: "Python Data Science & Algorithms",
    files: {
      "main.py": `"""
Python Momentum IDE Demo
Algorithms, Statistics & Data Analysis
"""

import math

def calculate_statistics(data):
    """Calculate mean, variance, and standard deviation"""
    if not data:
        return None
    n = len(data)
    mean = sum(data) / n
    variance = sum((x - mean) ** 2 for x in data) / (n - 1 if n > 1 else 1)
    std_dev = math.sqrt(variance)
    return {
        "count": n,
        "mean": round(mean, 3),
        "variance": round(variance, 3),
        "std_dev": round(std_dev, 3),
        "min": min(data),
        "max": max(data)
    }

def quick_sort(arr):
    """Classic QuickSort algorithm implementation"""
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

# Test execution
if __name__ == "__main__":
    print("=== Momentum IDE Python Runner ===")
    sample_dataset = [45, 12, 85, 32, 89, 39, 69, 44, 42, 1, 99, 53]
    print(f"Raw Input Data: {sample_dataset}")
    
    sorted_dataset = quick_sort(sample_dataset)
    print(f"Sorted via QuickSort: {sorted_dataset}")
    
    stats = calculate_statistics(sample_dataset)
    print("\\nDescriptive Statistics:")
    for k, v in stats.items():
        print(f"  • {k.ljust(10)}: {v}")
    
    print("\\nExecution finished successfully [Code 0]")
`,
      "README.md": `# Python Data Science & Algorithms

This project demonstrates algorithmic problem solving and statistical computing in the **Momentum VS Code IDE**.

### Features:
- QuickSort Algorithm
- Basic Statistics: Mean, Variance, Standard Deviation
- Interactive Terminal Execution

### How to Run:
1. Open the Terminal panel below (\`Ctrl+\` \` or toggle tab).
2. Type:
\`\`\`bash
python main.py
\`\`\`
3. Press **Enter** to see instant execution output!
`
    }
  },
  "react-todo": {
    name: "Modern Web Task Manager",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Momentum Tasks</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app-card">
    <header>
      <h2>⚡ Momentum Task Tracker</h2>
      <p id="date-label"></p>
    </header>
    <div class="input-group">
      <input type="text" id="task-input" placeholder="What needs to be done today?">
      <button id="add-btn">Add Task</button>
    </div>
    <div class="filter-group">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="active">Active</button>
      <button class="filter-btn" data-filter="completed">Completed</button>
    </div>
    <ul id="task-list"></ul>
    <footer>
      <span id="items-left">0 items left</span>
      <button id="clear-completed">Clear Completed</button>
    </footer>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      "style.css": `:root {
  --primary: #3b82f6;
  --bg: #0f172a;
  --card-bg: #1e293b;
  --text: #f8fafc;
  --text-muted: #94a3b8;
  --border: #334155;
  --danger: #ef4444;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg);
  color: var(--text);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.app-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  padding: 28px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

header h2 {
  font-size: 24px;
  margin-bottom: 6px;
  color: #60a5fa;
}

header p {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

input[type="text"] {
  flex: 1;
  background: #0f172a;
  border: 1px solid var(--border);
  padding: 12px 16px;
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  outline: none;
}

input[type="text"]:focus {
  border-color: var(--primary);
}

button {
  background: var(--primary);
  color: #fff;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

button:hover {
  opacity: 0.9;
}

.filter-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-btn {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  padding: 6px 14px;
  font-size: 13px;
}

.filter-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

#task-list {
  list-style: none;
  max-height: 300px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--border);
  animation: fadeIn 0.2s;
}

.task-item.completed span {
  text-decoration: line-through;
  color: var(--text-muted);
}

.task-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.delete-btn {
  background: transparent;
  color: var(--danger);
  padding: 4px 8px;
  font-size: 12px;
}

footer {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
}

#clear-completed {
  background: transparent;
  color: var(--text-muted);
  padding: 4px 8px;
  font-size: 13px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}`,
      "script.js": `let tasks = [
  { id: 1, text: "Explore Momentum VS Code Web IDE", completed: true },
  { id: 2, text: "Upload custom project folder", completed: false },
  { id: 3, text: "Try running terminal commands (node, ls, clear)", completed: false },
  { id: 4, text: "Test Live Preview button in top bar", completed: false }
];

let filter = 'all';

const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const itemsLeft = document.getElementById('items-left');
const clearBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');
const dateLabel = document.getElementById('date-label');

dateLabel.textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
});

function render() {
  taskList.innerHTML = '';
  const filtered = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  filtered.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');

    const left = document.createElement('div');
    left.className = 'task-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const span = document.createElement('span');
    span.textContent = task.text;

    left.appendChild(checkbox);
    left.appendChild(span);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteTask(task.id));

    li.appendChild(left);
    li.appendChild(delBtn);
    taskList.appendChild(li);
  });

  const activeCount = tasks.filter(t => !t.completed).length;
  itemsLeft.textContent = activeCount + ' items left';
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now(), text, completed: false });
  taskInput.value = '';
  render();
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (t) t.completed = !t.completed;
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(x => x.id !== id);
  render();
}

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
  });
});

clearBtn.addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  render();
});

render();
`
    }
  }
};
