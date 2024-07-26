let domReplay = document.querySelector("#replay");
let domScore = document.querySelector("#score");
let domCanvas = document.createElement("canvas");
document.querySelector("#canvas").appendChild(domCanvas);
let ctx = domCanvas.getContext("2d");

const W = (domCanvas.width = 500);
const H = (domCanvas.height = 500);

let snake, food, cells = 20, cellSize, isGameOver = false, score = 0, maxScore = parseInt(window.localStorage.getItem("maxScore") || "0"), particles = [], splashingParticleCount = 20, requestID;

const helpers = {
  Vec: class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }
    mult(v) {
      if (v instanceof helpers.Vec) {
        this.x *= v.x;
        this.y *= v.y;
      } else {
        this.x *= v;
        this.y *= v;
      }
      return this;
    }
  },
  isCollision(v1, v2) {
    return v1.x === v2.x && v1.y === v2.y;
  },
  garbageCollector() {
    particles = particles.filter(p => p.size > 0);
  },
  drawGrid() {
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = "#181825";
    for (let i = 1; i < cells; i++) {
      let f = (W / cells) * i;
      ctx.beginPath();
      ctx.moveTo(f, 0);
      ctx.lineTo(f, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, f);
      ctx.lineTo(W, f);
      ctx.stroke();
    }
  },
  randHue() {
    return Math.floor(Math.random() * 360);
  },
  hsl2rgb(hue, saturation, lightness) {
    if (hue === undefined) return [0, 0, 0];
    let chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    let huePrime = hue / 60;
    let secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));
    huePrime = Math.floor(huePrime);
    let red, green, blue;
    if (huePrime === 0) {
      red = chroma;
      green = secondComponent;
      blue = 0;
    } else if (huePrime === 1) {
      red = secondComponent;
      green = chroma;
      blue = 0;
    } else if (huePrime === 2) {
      red = 0;
      green = chroma;
      blue = secondComponent;
    } else if (huePrime === 3) {
      red = 0;
      green = secondComponent;
      blue = chroma;
    } else if (huePrime === 4) {
      red = secondComponent;
      green = 0;
      blue = chroma;
    } else if (huePrime === 5) {
      red = chroma;
      green = 0;
      blue = secondComponent;
    }
    let lightnessAdjustment = lightness - chroma / 2;
    red += lightnessAdjustment;
    green += lightnessAdjustment;
    blue += lightnessAdjustment;
    return [Math.round(red * 255), Math.round(green * 255), Math.round(blue * 255)];
  },
  lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }
};

const KEY = {
  ArrowUp: false,
  ArrowRight: false,
  ArrowDown: false,
  ArrowLeft: false,
  resetState() {
    this.ArrowUp = false;
    this.ArrowRight = false;
    this.ArrowDown = false;
    this.ArrowLeft = false;
  },
  listen() {
    addEventListener("keydown", e => {
      if (e.key === "ArrowUp" && this.ArrowDown) return;
      if (e.key === "ArrowDown" && this.ArrowUp) return;
      if (e.key === "ArrowLeft" && this.ArrowRight) return;
      if (e.key === "ArrowRight" && this.ArrowLeft) return;
      this[e.key] = true;
      Object.keys(this).filter(f => f !== e.key && f !== "listen" && f !== "resetState").forEach(k => {
        this[k] = false;
      });
    }, false);
  }
};

class Snake {
  constructor() {
    this.pos = new helpers.Vec(W / 2, H / 2);
    this.dir = new helpers.Vec(0, 0);
    this.size = cellSize;
    this.color = "lightgreen";
    this.history = [];
    this.total = 1;
    this.delay = 7;
  }
  
  draw() {
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(255,255,255,.3)";
    ctx.fillRect(this.pos.x, this.pos.y, this.size, this.size);
    ctx.shadowBlur = 0;
    for (let i = 0; i < this.history.length; i++) {
      ctx.fillStyle = "lightgreen";
      ctx.fillRect(this.history[i].x, this.history[i].y, this.size, this.size);
      ctx.strokeStyle = "black";
      ctx.strokeRect(this.history[i].x, this.history[i].y, this.size, this.size);
    }
  }
  
  walls() {
    if (this.pos.x >= W) this.pos.x = 0;
    if (this.pos.y >= H) this.pos.y = 0;
    if (this.pos.y < 0) this.pos.y = H - this.size;
    if (this.pos.x < 0) this.pos.x = W - this.size;
  }
  
  controls() {
    let dir = this.size;
    if (KEY.ArrowUp) this.dir = new helpers.Vec(0, -dir);
    if (KEY.ArrowDown) this.dir = new helpers.Vec(0, dir);
    if (KEY.ArrowLeft) this.dir = new helpers.Vec(-dir, 0);
    if (KEY.ArrowRight) this.dir = new helpers.Vec(dir, 0);
  }
  
  selfCollision() {
    for (let i = 0; i < this.history.length; i++) {
      if (helpers.isCollision(this.pos, this.history[i])) {
        isGameOver = true;
      }
    }
  }
  
  update() {
    this.walls();
    this.controls();
    if (--this.delay <= 0) {
      if (helpers.isCollision(this.pos, food.pos)) {
        incrementScore();
        particleSplash();
        food.spawn();
        this.total++;
      }
      this.history.unshift(new helpers.Vec(this.pos.x, this.pos.y));
      if (this.history.length > this.total) this.history.pop();
      this.pos.add(this.dir);
      this.delay = 7;
      if (this.total > 3) this.selfCollision();
    }
    this.draw();
  }
}

class Food {
  constructor() {
    this.size = cellSize;
    this.color = "red";
    this.spawn();
  }
  
  draw() {
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x + this.size / 2, this.pos.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
  }
  
  spawn() {
    let randX = Math.floor(Math.random() * cells) * this.size;
    let randY = Math.floor(Math.random() * cells) * this.size;
    for (let path of snake.history) {
      if (helpers.isCollision(new helpers.Vec(randX, randY), path)) return this.spawn();
    }
    this.pos = new helpers.Vec(randX, randY);
  }
}

class Particle {
  constructor(pos, color, size, vel) {
    this.pos = pos;
    this.color = color;
    this.size = Math.abs(size / 2);
    this.ttl = 0;
    this.gravity = -0.2;
    this.vel = vel;
  }
  
  draw() {
    let { x, y } = this.pos;
    let [r, g, b] = helpers.hsl2rgb(...this.color.split(",").map(n => parseFloat(n)));
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillRect(x, y, this.size, this.size);
    ctx.globalCompositeOperation = "source-over";
  }
  
  update() {
    this.draw();
    this.size -= 0.3;
    this.ttl += 1;
    this.pos.add(this.vel);
    this.vel.y -= this.gravity;
  }
}

function incrementScore() {
  score++;
  domScore.innerText = score.toString().padStart(2, "0");
}

function particleSplash() {
  for (let i = 0; i < splashingParticleCount; i++) {
    let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3);
    let position = new helpers.Vec(food.pos.x, food.pos.y);
    particles.push(new Particle(position, `hsl(${helpers.randHue()}, 100%, 50%)`, food.size, vel));
  }
}

function clear() {
  ctx.clearRect(0, 0, W, H);
}

function initialize() {
  alert("Welcome to the Snake Game! Press an arrow key to start the game.");
  ctx.imageSmoothingEnabled = false;
  KEY.listen();
  cellSize = W / cells;
  snake = new Snake();
  food = new Food();
  domReplay.addEventListener("click", reset, false);
  loop();
}

function loop() {
  clear();
  if (!isGameOver) {
    requestID = requestAnimationFrame(loop);
    helpers.drawGrid();
    snake.update();
    food.draw();
    particles.forEach(p => p.update());
    helpers.garbageCollector();
  } else {
    clear();
    gameOver();
  }
}

function gameOver() {
  maxScore = Math.max(maxScore, score);
  window.localStorage.setItem("maxScore", maxScore);
  ctx.fillStyle = "#4cffd7";
  ctx.textAlign = "center";
  ctx.font = "bold 30px Poppins, sans-serif";
  ctx.fillText("GAME OVER", W / 2, H / 2);
  ctx.font = "15px Poppins, sans-serif";
  ctx.fillText(`SCORE ${score}`, W / 2, H / 2 + 30);
  ctx.fillText(`MAX SCORE ${maxScore}`, W / 2, H / 2 + 60);
}

function reset() {
  domScore.innerText = "00";
  score = 0;
  snake = new Snake();
  food.spawn();
  KEY.resetState();
  isGameOver = false;
  cancelAnimationFrame(requestID);
  loop();
}

initialize();
