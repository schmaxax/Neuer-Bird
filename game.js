(() => {
  const W = 400;
  const H = 600;
  const GRAVITY = 0.2;
  const FLAP = -7.2;
  const PIPE_GAP = 350;
  const PIPE_W = 30;
  const PIPE_SPEED = 2;
  const BIRD_X = 90;
  const GROUND = 520;
  const SAVE_EVERY = 5;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const saveCanvas = document.getElementById("save-canvas");
  const saveCtx = saveCanvas.getContext("2d");

  const gateScreen = document.getElementById("gate-screen");
  const startScreen = document.getElementById("start-screen");
  const saveScreen = document.getElementById("save-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const hud = document.getElementById("hud");
  const scoreEl = document.getElementById("score");
  const finalScoreEl = document.getElementById("final-score");
  const bestScoreEl = document.getElementById("best-score");
  const btnGateYes = document.getElementById("btn-gate-yes");
  const btnGateNo = document.getElementById("btn-gate-no");
  const btnStart = document.getElementById("btn-start");
  const btnRetry = document.getElementById("btn-retry");
  const jumpscareEl = document.getElementById("jumpscare");
  const bgAudio = document.getElementById("bg-audio");
  const scareAudio = document.getElementById("scare-audio");
  const miniEyebrow = document.getElementById("mini-eyebrow");
  const miniTitle = document.getElementById("mini-title");
  const miniKeys = document.getElementById("mini-keys");

  const BG_VOLUME = 0.18;
  const SCARE_VOLUME = 1;

  const MINI_TYPES = [
    "penalty",
    "basketball",
    "baseball",
    "judo",
    "dart",
    "cans",
    "bowling",
    "fart",
  ];

  const MINI_META = {
    penalty: {
      eyebrow: "ELFMETER",
      title: "Halt den Ball, Manuel!",
      keys: "Maus bewegen · Touch · ← → / A D",
      explain:
        "Bewege die Maus (oder ← →), damit Manuel den Ball hält. Bleib nah am Ball, bis er ankommt.",
    },
    basketball: {
      eyebrow: "BASKETBALL",
      title: "Wirf den Korb!",
      keys: "← → zielen · Leertaste / Klick = werfen",
      explain:
        "Ziele mit ← → oder der Maus. Die Power-Leiste schwankt — wirf mit Leertaste oder Klick, wenn die Kraft passt.",
    },
    baseball: {
      eyebrow: "BASEBALL",
      title: "Schlag den Ball!",
      keys: "Leertaste / Klick im grünen Fenster",
      explain:
        "Der Ball fliegt auf dich zu. Schlage mit Leertaste oder Klick genau im grünen Timing-Fenster.",
    },
    judo: {
      eyebrow: "JUDO",
      title: "Wirf ihn um!",
      keys: "Leertaste / Klick so schnell wie möglich",
      explain:
        "Drücke Leertaste oder klicke so oft wie möglich, bevor die Zeit abläuft — wirf den Gegner um!",
    },
    dart: {
      eyebrow: "DART",
      title: "Bullseye, Manuel!",
      keys: "Leertaste / Klick wenn nah am Zentrum",
      explain:
        "Der Dart kreist um die Scheibe. Drücke Leertaste oder klicke, wenn er nah am Zentrum ist.",
    },
    cans: {
      eyebrow: "DOSENWERFEN",
      title: "Alle Dosen um!",
      keys: "← → zielen · Leertaste / Klick = werfen",
      explain:
        "Ziele mit ← → oder der Maus und wirf mit Leertaste oder Klick. Alle Dosen müssen fallen.",
    },
    bowling: {
      eyebrow: "BOWLING",
      title: "Strike!",
      keys: "← → zielen · Leertaste / Klick = rollen",
      explain:
        "Ziele die Bahn an und rolle mit Leertaste oder Klick. Alle Pins müssen fallen (Strike).",
    },
    fart: {
      eyebrow: "NOTFALL",
      title: "Furzen — nicht kacken!",
      keys: "Leertaste / Klick im grünen Feld",
      explain:
        "Die Nadel steht fest, das grüne Feld bewegt sich. Klicke oder drücke Leertaste nur im grünen Bereich.",
    },
  };

  let mode = "gate"; // gate | start | play | save | over | scare | denied
  let bird, pipes, score, best, frame, pendingSaveAt;
  let clouds = [];
  let saveState = null;
  let raf = 0;
  let scareArmed = false;
  let scareTimer = 0;
  let scareDone = false;
  let resumeAfterScare = null;
  let maxCheat = false;
  let cheatBuf = "";

  const playerImg = new Image();
  playerImg.src = "assets/images/player.png";
  const BIRD_DRAW_W = 52;
  const BIRD_DRAW_H = 64;

  bgAudio.volume = BG_VOLUME;
  scareAudio.volume = SCARE_VOLUME;

  best = Number(localStorage.getItem("neuer-bird-best") || 0);
  bestScoreEl.textContent = String(best);

  function startBackgroundMusic() {
    bgAudio.volume = BG_VOLUME;
    bgAudio.loop = true;
    const play = bgAudio.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
  }

  function armJumpscare() {
    // Selten: nur ~12% Chance pro Runde, und dann erst nach langer Zeit
    if (Math.random() > 0.12) {
      scareArmed = false;
      scareDone = true;
      scareTimer = 0;
      return;
    }
    scareArmed = true;
    scareDone = false;
    // ~90–180 Sekunden bei 60 fps
    scareTimer = 5400 + Math.floor(Math.random() * 5400);
  }

  function triggerJumpscare(after) {
    if (scareDone || mode === "scare") return;
    scareDone = true;
    scareArmed = false;
    resumeAfterScare = after || null;

    const prevMode = mode;
    mode = "scare";
    cancelAnimationFrame(raf);
    hud.hidden = true;

    bgAudio.volume = 0.04;
    scareAudio.currentTime = 0;
    const scarePlay = scareAudio.play();
    if (scarePlay && typeof scarePlay.catch === "function") scarePlay.catch(() => {});

    jumpscareEl.hidden = false;
    jumpscareEl.classList.add("is-shake");
    jumpscareEl.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      jumpscareEl.hidden = true;
      jumpscareEl.classList.remove("is-shake");
      jumpscareEl.setAttribute("aria-hidden", "true");
      bgAudio.volume = BG_VOLUME;

      if (typeof resumeAfterScare === "function") {
        const next = resumeAfterScare;
        resumeAfterScare = null;
        next();
      } else if (prevMode === "play") {
        mode = "play";
        hud.hidden = false;
        loop();
      } else if (prevMode === "save") {
        mode = "save";
        saveLoop();
      }
    }, 1800);
  }

  function resetPlay() {
    bird = {
      y: H / 2,
      vy: FLAP,
      rot: -0.35,
      r: 22,
    };
    pipes = [];
    score = 0;
    frame = 0;
    pendingSaveAt = SAVE_EVERY;
    maxCheat = false;
    cheatBuf = "";
    scoreEl.textContent = "0";
    spawnPipe();
    spawnPipe(W + 220);
    clouds = [
      { x: 40, y: 70, s: 1 },
      { x: 220, y: 110, s: 0.7 },
      { x: 320, y: 55, s: 0.9 },
    ];
  }

  function tryMaxCheat(code) {
    if (mode !== "play" || maxCheat) return;
    const map = { KeyM: "M", KeyA: "A", KeyX: "X" };
    const ch = map[code];
    if (!ch) {
      cheatBuf = "";
      return;
    }
    cheatBuf = (cheatBuf + ch).slice(-3);
    if (cheatBuf === "MAX") {
      maxCheat = true;
      cheatBuf = "";
      bird.y = H / 2;
      bird.vy = 0;
      bird.rot = 0;
    }
  }

  function spawnPipe(x = W + 40) {
    const top = 70 + Math.random() * (GROUND - PIPE_GAP - 140);
    pipes.push({
      x,
      top,
      bottom: top + PIPE_GAP,
      scored: false,
    });
  }

  function flap() {
    if (mode === "play") {
      bird.vy = FLAP;
    }
  }

  function passGate() {
    mode = "start";
    gateScreen.hidden = true;
    startScreen.hidden = false;
    drawIdle();
  }

  function denyGate() {
    mode = "denied";
    cancelAnimationFrame(raf);
    window.close();
    document.documentElement.innerHTML =
      "<body style='margin:0;background:#000;color:#666;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh'>Kein Zutritt.</body>";
  }

  function startGame() {
    if (mode === "gate" || mode === "denied") return;
    resetPlay();
    mode = "play";
    gateScreen.hidden = true;
    startScreen.hidden = true;
    gameoverScreen.hidden = true;
    saveScreen.hidden = true;
    jumpscareEl.hidden = true;
    jumpscareEl.classList.remove("is-shake");
    hud.hidden = false;
    startBackgroundMusic();
    armJumpscare();
    loop();
  }

  function gameOver() {
    cancelAnimationFrame(raf);
    scareArmed = false;
    showGameOver();
  }

  function showGameOver() {
    mode = "over";
    hud.hidden = true;
    saveScreen.hidden = true;
    finalScoreEl.textContent = String(score);
    if (score > best) {
      best = score;
      localStorage.setItem("neuer-bird-best", String(best));
    }
    bestScoreEl.textContent = String(best);
    gameoverScreen.hidden = false;
  }

  function difficulty() {
    return Math.min(1, score / 55);
  }

  function ballDurationForScore(s) {
    const base = 280;
    const perPoint = 2;
    return Math.max(120, Math.round(base - s * perPoint));
  }

  function setMiniCopy(type, overrides = {}) {
    const meta = MINI_META[type] || MINI_META.penalty;
    if (miniEyebrow) miniEyebrow.textContent = overrides.eyebrow || meta.eyebrow;
    if (miniTitle) miniTitle.textContent = overrides.title || meta.title;
    if (miniKeys) miniKeys.textContent = overrides.keys || meta.keys;
  }

  function pickMinigame() {
    return MINI_TYPES[Math.floor(Math.random() * MINI_TYPES.length)];
  }

  function dismissHowto() {
    if (!saveState || !saveState.howto || saveState.resolved) return;
    saveState.howto = false;
    setMiniCopy(saveState.type);
  }

  function beginSaveChallenge() {
    mode = "save";
    saveScreen.hidden = false;
    hud.hidden = true;

    const type = pickMinigame();
    setMiniCopy(type, {
      title: "So geht’s",
      keys: "Klick / Leertaste = Start",
    });

    const d = difficulty();
    const base = {
      type,
      resolved: false,
      saved: false,
      flash: 0,
      countdown: 0,
      message: "",
      howto: true,
    };

    if (type === "penalty") {
      const side = Math.random() < 0.5 ? -1 : 1;
      saveState = {
        ...base,
        t: 0,
        duration: ballDurationForScore(score),
        keeperX: 0,
        targetX: side * (60 + Math.random() * 40),
        ballY: 40,
        ballX: 0,
        dive: 0,
      };
    } else if (type === "basketball") {
      saveState = {
        ...base,
        phase: "aim",
        aimX: 0,
        power: 0.2,
        powerDir: 1,
        powerSpeed: 0.01 + d * 0.01,
        ballX: 180,
        ballY: 240,
        vx: 0,
        vy: 0,
        hoopX: 150 + Math.random() * 60,
        hoopY: 70,
      };
    } else if (type === "baseball") {
      const duration = Math.max(100, Math.round(150 - d * 30));
      const windowStart = 0.58 + Math.random() * 0.08;
      saveState = {
        ...base,
        t: 0,
        duration,
        windowStart,
        windowEnd: windowStart + (0.24 - d * 0.05),
        swung: false,
        batAngle: 0,
      };
    } else if (type === "judo") {
      const judoTime = 300; // 5 Sekunden bei 60 fps
      saveState = {
        ...base,
        taps: 0,
        needed: Math.round(10 + d * 8),
        time: judoTime,
        maxTime: judoTime,
        pulse: 0,
        opponentLean: 0,
      };
    } else if (type === "dart") {
      saveState = {
        ...base,
        phase: "aim",
        angle: Math.random() * Math.PI * 2,
        radius: 0,
        spin: 0.035 + d * 0.03,
        wobble: 32 + d * 18,
        dartX: 180,
        dartY: 140,
      };
    } else if (type === "cans") {
      const cans = [];
      const baseY = 175;
      for (let row = 0; row < 3; row++) {
        const count = 3 - row;
        for (let i = 0; i < count; i++) {
          cans.push({
            x: 180 + (i - (count - 1) / 2) * 34,
            y: baseY - row * 32,
            vx: 0,
            vy: 0,
            rot: 0,
            fallen: false,
          });
        }
      }
      saveState = {
        ...base,
        phase: "aim",
        aimX: 0,
        power: 0.25,
        powerDir: 1,
        powerSpeed: 0.011 + d * 0.008,
        ballX: 180,
        ballY: 250,
        vx: 0,
        vy: 0,
        cans,
      };
    } else if (type === "bowling") {
      const pins = [];
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i <= row; i++) {
          pins.push({
            x: 180 + (i - row / 2) * 22,
            y: 55 + row * 22,
            hit: false,
            ox: 0,
            oy: 0,
            rot: 0,
          });
        }
      }
      saveState = {
        ...base,
        phase: "aim",
        aimX: (Math.random() - 0.5) * 28,
        ballX: 180,
        ballY: 250,
        vx: 0,
        vy: 0,
        pins,
        drift: 0,
      };
    } else if (type === "fart") {
      const zoneW = Math.max(42, 95 - d * 28);
      saveState = {
        ...base,
        hits: 0,
        needed: 2,
        zoneX: 80,
        zoneW,
        zoneDir: 1,
        zoneSpeed: 1.1 + d * 1.1,
        needle: 180,
        feedback: 0,
        lastResult: "",
      };
    }
  }

  function resolveSave(saved, message) {
    if (!saveState || saveState.resolved) return;
    saveState.resolved = true;
    saveState.saved = saved;
    saveState.flash = 18;
    if (message) saveState.message = message;

    setTimeout(() => {
      if (saved) {
        beginResumeCountdown();
      } else {
        saveScreen.hidden = true;
        gameOver();
      }
    }, 800);
  }

  function beginResumeCountdown() {
    if (!saveState) return;
    saveState.countdown = 3;
    setMiniCopy(saveState.type, {
      title: "Weiter in …",
      keys: "Gleich geht’s weiterfliegen",
    });

    const tick = () => {
      if (!saveState || mode !== "save") return;
      if (saveState.countdown <= 1) {
        saveScreen.hidden = true;
        mode = "play";
        hud.hidden = false;
        pendingSaveAt = score + SAVE_EVERY;
        loop();
        return;
      }
      saveState.countdown -= 1;
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);
  }

  // ——— Minigame updates ———

  function updatePenalty(s) {
    s.t += 1;
    const p = Math.min(1, s.t / s.duration);
    const ease = p * p * p;
    s.ballX = s.targetX * ease;
    s.ballY = 40 + (170 - 40) * ease;

    if (s.t >= s.duration) {
      const reach = Math.abs(s.keeperX - s.targetX);
      const saved = reach < 62;
      if (saved) s.dive = Math.sign(s.targetX) || 1;
      resolveSave(saved, saved ? "GEHALTEN!" : "TOR!");
    }
  }

  function updateBasketball(s) {
    if (s.phase === "aim") {
      s.power += s.powerDir * s.powerSpeed;
      if (s.power >= 1) {
        s.power = 1;
        s.powerDir = -1;
      }
      if (s.power <= 0.08) {
        s.power = 0.08;
        s.powerDir = 1;
      }
      return;
    }

    if (s.phase === "fly") {
      s.vy += 0.35;
      s.ballX += s.vx;
      s.ballY += s.vy;

      const rimY = s.hoopY + 18;
      const inX = Math.abs(s.ballX - s.hoopX) < 28;
      const crossing =
        s.vy > 0 && s.ballY >= rimY - 10 && s.ballY <= rimY + 16;
      if (inX && crossing) {
        s.phase = "done";
        resolveSave(true, "KORB!");
        return;
      }

      if (s.ballY > 290 || s.ballX < -20 || s.ballX > 380) {
        s.phase = "done";
        resolveSave(false, "LUFT!");
      }
    }
  }

  function updateBaseball(s) {
    if (s.swung) {
      s.batAngle = Math.min(1.2, s.batAngle + 0.18);
      return;
    }
    s.t += 1;
    if (s.t >= s.duration) {
      resolveSave(false, "STREICH!");
    }
  }

  function updateJudo(s) {
    if (s.pulse > 0) s.pulse -= 1;
    s.time -= 1;
    s.opponentLean = Math.min(1, s.taps / s.needed);
    if (s.taps >= s.needed) {
      resolveSave(true, "IPPON!");
      return;
    }
    if (s.time <= 0) {
      resolveSave(false, "BESIEGT!");
    }
  }

  function updateDart(s) {
    if (s.phase !== "aim") return;
    s.angle += s.spin;
    s.radius = 8 + Math.abs(Math.sin(s.angle * 0.7)) * s.wobble;
    s.dartX = 180 + Math.cos(s.angle) * s.radius;
    s.dartY = 140 + Math.sin(s.angle) * s.radius * 0.75;
  }

  function updateCans(s) {
    if (s.phase === "aim") {
      s.power += s.powerDir * s.powerSpeed;
      if (s.power >= 1) {
        s.power = 1;
        s.powerDir = -1;
      }
      if (s.power <= 0.1) {
        s.power = 0.1;
        s.powerDir = 1;
      }
      return;
    }

    if (s.phase === "fly") {
      s.vy += 0.28;
      s.ballX += s.vx;
      s.ballY += s.vy;

      for (const can of s.cans) {
        if (can.fallen) {
          can.x += can.vx;
          can.y += can.vy;
          can.vy += 0.25;
          can.rot += can.vx * 0.08;
          continue;
        }
        const dx = can.x - s.ballX;
        const dy = can.y - s.ballY;
        if (dx * dx + dy * dy < 28 * 28) {
          can.fallen = true;
          can.vx = s.vx * 0.6 + (Math.random() - 0.5) * 3;
          can.vy = -2 - Math.random() * 2;
        }
      }

      const allDown = s.cans.every((c) => c.fallen);
      if (allDown) {
        s.phase = "done";
        resolveSave(true, "ALLE WEG!");
        return;
      }

      if (s.ballY > 300 || s.ballX < -30 || s.ballX > 390) {
        s.phase = "done";
        const down = s.cans.filter((c) => c.fallen).length;
        resolveSave(false, `${down}/${s.cans.length} DOSEN`);
      }
    }
  }

  function updateBowling(s) {
    if (s.phase === "aim") return;

    if (s.phase === "roll") {
      s.ballY -= 4.2;
      s.ballX += s.vx + Math.sin(s.ballY * 0.04) * s.drift;
      s.vx *= 0.995;

      for (const pin of s.pins) {
        if (pin.hit) {
          pin.ox += pin.vx || 0;
          pin.oy += pin.vy || 0;
          pin.rot += 0.2;
          continue;
        }
        const dx = pin.x - s.ballX;
        const dy = pin.y - s.ballY;
        if (dx * dx + dy * dy < 20 * 20) {
          pin.hit = true;
          pin.vx = (dx || 1) * 0.35 + (Math.random() - 0.5) * 2;
          pin.vy = -1.5 - Math.random();
        }
      }

      // pin-pin cascade
      for (const a of s.pins) {
        if (!a.hit) continue;
        for (const b of s.pins) {
          if (b.hit) continue;
          const dx = b.x - (a.x + a.ox);
          const dy = b.y - (a.y + a.oy);
          if (dx * dx + dy * dy < 18 * 18) {
            b.hit = true;
            b.vx = dx * 0.2 + (Math.random() - 0.5);
            b.vy = -1;
          }
        }
      }

      if (s.ballY < 20) {
        s.phase = "done";
        const hit = s.pins.filter((p) => p.hit).length;
        const all = hit === s.pins.length;
        resolveSave(all, all ? "STRIKE!" : `${hit}/${s.pins.length}`);
      }
    }
  }

  function updateFart(s) {
    if (s.feedback > 0) s.feedback -= 1;
    s.zoneX += s.zoneDir * s.zoneSpeed;
    const minX = 30;
    const maxX = 360 - s.zoneW - 30;
    if (s.zoneX <= minX) {
      s.zoneX = minX;
      s.zoneDir = 1;
    }
    if (s.zoneX >= maxX) {
      s.zoneX = maxX;
      s.zoneDir = -1;
    }
  }

  function updateSave() {
    const s = saveState;
    if (!s || s.resolved || s.howto) return;

    switch (s.type) {
      case "penalty":
        updatePenalty(s);
        break;
      case "basketball":
        updateBasketball(s);
        break;
      case "baseball":
        updateBaseball(s);
        break;
      case "judo":
        updateJudo(s);
        break;
      case "dart":
        updateDart(s);
        break;
      case "cans":
        updateCans(s);
        break;
      case "bowling":
        updateBowling(s);
        break;
      case "fart":
        updateFart(s);
        break;
    }
  }

  // ——— Drawing helpers ———

  function drawBall(c, x, y, r, color = "#f7f4ef") {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#111";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  }

  function drawSoccerBall(c, x, y, r) {
    drawBall(c, x, y, r);
    c.beginPath();
    c.moveTo(x, y - r * 0.45);
    c.lineTo(x + r * 0.4, y - r * 0.1);
    c.lineTo(x + r * 0.25, y + r * 0.4);
    c.lineTo(x - r * 0.25, y + r * 0.4);
    c.lineTo(x - r * 0.4, y - r * 0.1);
    c.closePath();
    c.stroke();
  }

  function drawPowerBar(c, x, y, w, h, power) {
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.fillRect(x, y, w, h);
    const fill = Math.max(0, Math.min(1, power));
    const grad = c.createLinearGradient(x, y + h, x, y);
    grad.addColorStop(0, "#c8102e");
    grad.addColorStop(0.55, "#e8c547");
    grad.addColorStop(1, "#248a4e");
    c.fillStyle = grad;
    c.fillRect(x, y + h * (1 - fill), w, h * fill);
    c.strokeStyle = "rgba(247,244,239,0.5)";
    c.strokeRect(x, y, w, h);
    // sweet zone marker
    c.fillStyle = "rgba(247,244,239,0.35)";
    c.fillRect(x - 2, y + h * 0.2, w + 4, h * 0.25);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(" ");
    let line = "";
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, yy);
      yy += lineHeight;
    }
    return yy;
  }

  function drawHowtoOverlay(s, sw, sh) {
    if (!s.howto) return;
    const meta = MINI_META[s.type] || MINI_META.penalty;
    const cx = sw / 2;

    saveCtx.fillStyle = "rgba(7, 16, 24, 0.82)";
    saveCtx.fillRect(0, 0, sw, sh);

    saveCtx.fillStyle = "rgba(232, 197, 71, 0.95)";
    saveCtx.font = '700 14px "DM Sans", sans-serif';
    saveCtx.textAlign = "center";
    saveCtx.fillText("ERKLÄRUNG", cx, 48);

    saveCtx.fillStyle = "#f7f4ef";
    saveCtx.font = '700 28px "Bebas Neue", sans-serif';
    saveCtx.fillText(meta.title, cx, 82);

    saveCtx.font = '600 15px "DM Sans", sans-serif';
    wrapText(saveCtx, meta.explain, cx, 118, sw - 56, 22);

    saveCtx.fillStyle = "rgba(232, 197, 71, 0.95)";
    saveCtx.font = '700 18px "Bebas Neue", sans-serif';
    saveCtx.fillText("KLICK / LEERTASTE = WEITER", cx, sh - 36);
  }

  function drawResultOverlay(s, sw, sh) {
    if (!s.resolved) return;
    const cx = sw / 2;
    saveCtx.fillStyle = s.saved ? "rgba(36,138,78,0.55)" : "rgba(200,16,46,0.55)";
    saveCtx.fillRect(0, 0, sw, sh);
    saveCtx.fillStyle = "#f7f4ef";
    saveCtx.textAlign = "center";
    if (s.countdown) {
      saveCtx.font = '700 96px "Bebas Neue", sans-serif';
      saveCtx.fillText(String(s.countdown), cx, sh / 2 + 12);
      saveCtx.font = '600 16px "DM Sans", sans-serif';
      saveCtx.fillText("Weiterfliegen", cx, sh / 2 + 52);
    } else {
      saveCtx.font = '700 28px "Bebas Neue", sans-serif';
      saveCtx.fillText(s.message || (s.saved ? "GEWONNEN!" : "VERLOREN!"), cx, sh / 2);
    }
  }

  function fillScene(top, bottom) {
    const g = saveCtx.createLinearGradient(0, 0, 0, saveCanvas.height);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    saveCtx.fillStyle = g;
    saveCtx.fillRect(0, 0, saveCanvas.width, saveCanvas.height);
  }

  // ——— Draw each game ———

  function drawPenalty(s) {
    const sw = saveCanvas.width;
    const sh = saveCanvas.height;
    const cx = sw / 2;
    const goalY = 200;

    fillScene("#163d28", "#1f6b3f");

    saveCtx.strokeStyle = "#f7f4ef";
    saveCtx.lineWidth = 6;
    saveCtx.beginPath();
    saveCtx.moveTo(40, 60);
    saveCtx.lineTo(40, goalY);
    saveCtx.lineTo(sw - 40, goalY);
    saveCtx.lineTo(sw - 40, 60);
    saveCtx.stroke();

    saveCtx.strokeStyle = "rgba(247,244,239,0.25)";
    saveCtx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = 50 + i * ((sw - 100) / 7);
      saveCtx.beginPath();
      saveCtx.moveTo(x, 65);
      saveCtx.lineTo(x, goalY - 4);
      saveCtx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const y = 70 + i * 28;
      saveCtx.beginPath();
      saveCtx.moveTo(45, y);
      saveCtx.lineTo(sw - 45, y);
      saveCtx.stroke();
    }

    drawNeuer(saveCtx, cx + s.keeperX, goalY - 8, 1.35, s.dive * 0.35);
    drawSoccerBall(saveCtx, cx + s.ballX, s.ballY, 11);
  }

  function drawBasketball(s) {
    fillScene("#1a2740", "#2a4060");
    const floorY = 255;
    saveCtx.fillStyle = "#8b5a2b";
    saveCtx.fillRect(0, floorY, 360, 25);

    // backboard + hoop
    saveCtx.fillStyle = "#f7f4ef";
    saveCtx.fillRect(s.hoopX - 28, s.hoopY - 8, 56, 36);
    saveCtx.strokeStyle = "#c8102e";
    saveCtx.lineWidth = 4;
    saveCtx.beginPath();
    saveCtx.ellipse(s.hoopX, s.hoopY + 18, 20, 7, 0, 0, Math.PI * 2);
    saveCtx.stroke();
    saveCtx.strokeStyle = "rgba(232,197,71,0.7)";
    saveCtx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = s.hoopX - 14 + i * 5.5;
      saveCtx.beginPath();
      saveCtx.moveTo(x, s.hoopY + 20);
      saveCtx.lineTo(s.hoopX + (x - s.hoopX) * 0.3, s.hoopY + 42);
      saveCtx.stroke();
    }

    drawNeuer(saveCtx, 180 + s.aimX * 0.15, 230, 0.7, 0);
    drawBall(saveCtx, s.ballX, s.ballY, 12, "#e67e22");

    if (s.phase === "aim") {
      drawPowerBar(saveCtx, 320, 60, 18, 140, s.power);
      saveCtx.strokeStyle = "rgba(247,244,239,0.4)";
      saveCtx.setLineDash([4, 4]);
      saveCtx.beginPath();
      saveCtx.moveTo(s.ballX, s.ballY);
      saveCtx.quadraticCurveTo(
        s.ballX + s.aimX * 0.55,
        s.ballY - 80 - s.power * 40,
        s.hoopX,
        s.hoopY + 10
      );
      saveCtx.stroke();
      saveCtx.setLineDash([]);
    }
  }

  function drawBaseball(s) {
    fillScene("#1e3a2f", "#2d5a40");
    const p = Math.min(1, s.t / s.duration);
    const ballY = 40 + p * 180;
    const ballX = 180 + Math.sin(p * 6) * 8;

    // plate
    saveCtx.fillStyle = "#f7f4ef";
    saveCtx.beginPath();
    saveCtx.moveTo(180, 230);
    saveCtx.lineTo(205, 245);
    saveCtx.lineTo(180, 255);
    saveCtx.lineTo(155, 245);
    saveCtx.closePath();
    saveCtx.fill();

    // timing window
    const winTop = 40 + s.windowStart * 180;
    const winBot = 40 + s.windowEnd * 180;
    saveCtx.fillStyle = "rgba(36,138,78,0.35)";
    saveCtx.fillRect(40, winTop, 280, winBot - winTop);
    saveCtx.strokeStyle = "#248a4e";
    saveCtx.strokeRect(40, winTop, 280, winBot - winTop);

    drawNeuer(saveCtx, 180, 220, 0.85, s.batAngle ? -0.4 : 0.15);

    // bat
    saveCtx.save();
    saveCtx.translate(200, 210);
    saveCtx.rotate(-0.8 + s.batAngle);
    saveCtx.fillStyle = "#c4a35a";
    saveCtx.fillRect(0, -4, 55, 8);
    saveCtx.restore();

    drawBall(saveCtx, ballX, ballY, 10, "#f7f4ef");
  }

  function drawJudo(s) {
    fillScene("#3a1a1a", "#5a2a2a");
    saveCtx.fillStyle = "#f0e6d0";
    saveCtx.fillRect(40, 180, 280, 70);

    // opponent
    const lean = s.opponentLean;
    saveCtx.save();
    saveCtx.translate(240 + lean * 30, 150 - lean * 20);
    saveCtx.rotate(lean * 0.9);
    saveCtx.fillStyle = "#fff";
    saveCtx.fillRect(-18, -40, 36, 70);
    saveCtx.fillStyle = "#222";
    saveCtx.beginPath();
    saveCtx.arc(0, -52, 14, 0, Math.PI * 2);
    saveCtx.fill();
    saveCtx.restore();

    drawNeuer(saveCtx, 110 - lean * 10, 155, 1.1, -0.2 - lean * 0.3);

    // meters
    const tapP = Math.min(1, s.taps / s.needed);
    saveCtx.fillStyle = "rgba(0,0,0,0.4)";
    saveCtx.fillRect(50, 40, 260, 18);
    saveCtx.fillStyle = "#e8c547";
    saveCtx.fillRect(50, 40, 260 * tapP, 18);
    saveCtx.strokeStyle = "#f7f4ef";
    saveCtx.strokeRect(50, 40, 260, 18);

    const timeP = Math.max(0, s.time / s.maxTime);
    saveCtx.fillStyle = "rgba(0,0,0,0.4)";
    saveCtx.fillRect(50, 68, 260, 10);
    saveCtx.fillStyle = timeP < 0.3 ? "#c8102e" : "#248a4e";
    saveCtx.fillRect(50, 68, 260 * timeP, 10);

    saveCtx.fillStyle = "#f7f4ef";
    saveCtx.font = '600 14px "DM Sans", sans-serif';
    saveCtx.textAlign = "center";
    saveCtx.fillText(`${s.taps} / ${s.needed} · HAMMER DIE TASTE`, 180, 110);

    if (s.pulse > 0) {
      saveCtx.fillStyle = `rgba(232,197,71,${s.pulse / 12})`;
      saveCtx.beginPath();
      saveCtx.arc(110, 155, 40 + (12 - s.pulse) * 2, 0, Math.PI * 2);
      saveCtx.fill();
    }
  }

  function drawDart(s) {
    fillScene("#1a2030", "#2a3040");
    const cx = 180;
    const cy = 140;

    // board
    const rings = [
      [70, "#c8102e"],
      [55, "#f7f4ef"],
      [40, "#c8102e"],
      [25, "#f7f4ef"],
      [12, "#e8c547"],
    ];
    for (const [r, col] of rings) {
      saveCtx.fillStyle = col;
      saveCtx.beginPath();
      saveCtx.arc(cx, cy, r, 0, Math.PI * 2);
      saveCtx.fill();
    }
    saveCtx.strokeStyle = "#111";
    saveCtx.lineWidth = 2;
    saveCtx.beginPath();
    saveCtx.arc(cx, cy, 70, 0, Math.PI * 2);
    saveCtx.stroke();

    // dart / crosshair
    saveCtx.strokeStyle = "#111";
    saveCtx.lineWidth = 2;
    saveCtx.beginPath();
    saveCtx.moveTo(s.dartX - 14, s.dartY);
    saveCtx.lineTo(s.dartX + 14, s.dartY);
    saveCtx.moveTo(s.dartX, s.dartY - 14);
    saveCtx.lineTo(s.dartX, s.dartY + 14);
    saveCtx.stroke();
    saveCtx.fillStyle = "#c8102e";
    saveCtx.beginPath();
    saveCtx.arc(s.dartX, s.dartY, 4, 0, Math.PI * 2);
    saveCtx.fill();

    saveCtx.fillStyle = "rgba(247,244,239,0.8)";
    saveCtx.font = '600 13px "DM Sans", sans-serif';
    saveCtx.textAlign = "center";
    saveCtx.fillText(s.phase === "aim" ? "Zum Goldkreis tippen!" : "", 180, 250);
  }

  function drawCans(s) {
    fillScene("#2a2418", "#4a3a28");
    saveCtx.fillStyle = "#5a4a38";
    saveCtx.fillRect(0, 210, 360, 70);

    for (const can of s.cans) {
      saveCtx.save();
      saveCtx.translate(can.x, can.y);
      saveCtx.rotate(can.rot || 0);
      saveCtx.fillStyle = "#c8102e";
      saveCtx.fillRect(-12, -18, 24, 32);
      saveCtx.fillStyle = "#f7f4ef";
      saveCtx.fillRect(-12, -6, 24, 8);
      saveCtx.strokeStyle = "#111";
      saveCtx.strokeRect(-12, -18, 24, 32);
      saveCtx.restore();
    }

    drawBall(saveCtx, s.ballX, s.ballY, 11, "#f7f4ef");
    drawNeuer(saveCtx, 60, 230, 0.65, 0.1);

    if (s.phase === "aim") {
      drawPowerBar(saveCtx, 320, 50, 18, 130, s.power);
      saveCtx.strokeStyle = "rgba(247,244,239,0.45)";
      saveCtx.setLineDash([3, 3]);
      saveCtx.beginPath();
      saveCtx.moveTo(s.ballX, s.ballY);
      saveCtx.lineTo(s.ballX + s.aimX * 0.8, s.ballY - 100 - s.power * 50);
      saveCtx.stroke();
      saveCtx.setLineDash([]);
    }
  }

  function drawBowling(s) {
    fillScene("#1a2838", "#243848");
    // lane
    saveCtx.fillStyle = "#c4a574";
    saveCtx.beginPath();
    saveCtx.moveTo(90, 270);
    saveCtx.lineTo(270, 270);
    saveCtx.lineTo(220, 30);
    saveCtx.lineTo(140, 30);
    saveCtx.closePath();
    saveCtx.fill();
    saveCtx.strokeStyle = "rgba(0,0,0,0.2)";
    saveCtx.beginPath();
    saveCtx.moveTo(180, 270);
    saveCtx.lineTo(180, 30);
    saveCtx.stroke();

    for (const pin of s.pins) {
      saveCtx.save();
      saveCtx.translate(pin.x + (pin.ox || 0), pin.y + (pin.oy || 0));
      saveCtx.rotate(pin.rot || 0);
      saveCtx.fillStyle = "#f7f4ef";
      saveCtx.beginPath();
      saveCtx.ellipse(0, 0, 7, 14, 0, 0, Math.PI * 2);
      saveCtx.fill();
      saveCtx.fillStyle = "#c8102e";
      saveCtx.fillRect(-7, -4, 14, 5);
      saveCtx.restore();
    }

    drawBall(saveCtx, s.ballX, s.ballY, 14, "#1a1a8a");
    if (s.phase === "aim") {
      saveCtx.fillStyle = "rgba(247,244,239,0.7)";
      saveCtx.font = '600 12px "DM Sans", sans-serif';
      saveCtx.textAlign = "center";
      saveCtx.fillText("Zielen, dann rollen", 180, 20);
    }
  }

  function drawFart(s) {
    fillScene("#2a2030", "#3a3040");

    saveCtx.fillStyle = "#f7f4ef";
    saveCtx.font = '700 22px "Bebas Neue", sans-serif';
    saveCtx.textAlign = "center";
    saveCtx.fillText("DRUCK-CONTROL", 180, 40);

    drawNeuer(saveCtx, 180, 120, 1.2, 0);

    // belly gauge
    saveCtx.fillStyle = "rgba(0,0,0,0.45)";
    saveCtx.fillRect(30, 200, 300, 36);

    // green zone
    saveCtx.fillStyle = "#248a4e";
    saveCtx.fillRect(s.zoneX, 200, s.zoneW, 36);
    saveCtx.fillStyle = "rgba(232,197,71,0.5)";
    saveCtx.fillRect(s.zoneX + s.zoneW * 0.3, 200, s.zoneW * 0.4, 36);

    // center needle
    saveCtx.fillStyle = "#f7f4ef";
    saveCtx.fillRect(s.needle - 2, 192, 4, 52);
    saveCtx.beginPath();
    saveCtx.moveTo(s.needle, 188);
    saveCtx.lineTo(s.needle - 8, 198);
    saveCtx.lineTo(s.needle + 8, 198);
    saveCtx.closePath();
    saveCtx.fill();

    saveCtx.font = '600 14px "DM Sans", sans-serif';
    saveCtx.fillText(`Sicher furzen: ${s.hits} / ${s.needed}`, 180, 260);

    if (s.feedback > 0 && s.lastResult) {
      saveCtx.font = '700 26px "Bebas Neue", sans-serif';
      saveCtx.fillStyle = s.lastResult === "FURZ!" ? "#e8c547" : "#c8102e";
      saveCtx.fillText(s.lastResult, 180, 175);
    }
  }

  function drawSave() {
    const s = saveState;
    if (!s) return;
    saveCtx.clearRect(0, 0, saveCanvas.width, saveCanvas.height);

    switch (s.type) {
      case "penalty":
        drawPenalty(s);
        break;
      case "basketball":
        drawBasketball(s);
        break;
      case "baseball":
        drawBaseball(s);
        break;
      case "judo":
        drawJudo(s);
        break;
      case "dart":
        drawDart(s);
        break;
      case "cans":
        drawCans(s);
        break;
      case "bowling":
        drawBowling(s);
        break;
      case "fart":
        drawFart(s);
        break;
    }

    drawResultOverlay(s, saveCanvas.width, saveCanvas.height);
    drawHowtoOverlay(s, saveCanvas.width, saveCanvas.height);
  }

  // ——— Input for minigames ———

  function miniAction() {
    const s = saveState;
    if (!s || s.resolved || mode !== "save") return;
    if (s.howto) {
      dismissHowto();
      return;
    }

    if (s.type === "basketball" && s.phase === "aim") {
      s.phase = "fly";
      const power = s.power;
      // Zielrichtung zum Ring, Power steuert Höhe/Weite
      const dx = s.hoopX - s.ballX;
      s.vx = dx * (0.035 + power * 0.025) + s.aimX * 0.02;
      s.vy = -9.2 - power * 6.5;
      return;
    }

    if (s.type === "baseball" && !s.swung) {
      s.swung = true;
      const p = s.t / s.duration;
      const hit = p >= s.windowStart && p <= s.windowEnd;
      setTimeout(() => resolveSave(hit, hit ? "HOME RUN!" : "FEHL!"), 280);
      return;
    }

    if (s.type === "judo") {
      s.taps += 1;
      s.pulse = 10;
      return;
    }

    if (s.type === "dart" && s.phase === "aim") {
      s.phase = "stuck";
      const dx = s.dartX - 180;
      const dy = s.dartY - 140;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ok = dist < 38;
      setTimeout(() => resolveSave(ok, ok ? "BULLSEYE!" : "DANEBEN!"), 350);
      return;
    }

    if (s.type === "cans" && s.phase === "aim") {
      s.phase = "fly";
      s.vx = s.aimX * 0.12;
      s.vy = -7 - s.power * 8;
      return;
    }

    if (s.type === "bowling" && s.phase === "aim") {
      s.phase = "roll";
      s.ballX = 180 + s.aimX;
      s.vx = s.aimX * 0.04;
      s.drift = (Math.random() - 0.5) * (0.15 + difficulty() * 0.3);
      return;
    }

    if (s.type === "fart") {
      if (s.feedback > 0) return;
      const inZone =
        s.needle >= s.zoneX && s.needle <= s.zoneX + s.zoneW;
      s.feedback = 22;
      if (inZone) {
        s.hits += 1;
        s.lastResult = "FURZ!";
        s.zoneSpeed += 0.18;
        s.zoneW = Math.max(34, s.zoneW - 3);
        if (s.hits >= s.needed) {
          setTimeout(() => resolveSave(true, "ERLEICHTERT!"), 400);
        }
      } else {
        s.lastResult = "KACK!";
        setTimeout(() => resolveSave(false, "KACK-ALARM!"), 450);
      }
    }
  }

  function miniMoveAim(dir) {
    const s = saveState;
    if (!s || s.resolved || s.howto || mode !== "save") return;

    if (s.type === "penalty") {
      s.keeperX = Math.max(-110, Math.min(110, s.keeperX + dir * 18));
    } else if (s.type === "basketball" && s.phase === "aim") {
      s.aimX = Math.max(-90, Math.min(90, s.aimX + dir * 14));
      s.ballX = 180 + s.aimX * 0.35;
    } else if (s.type === "cans" && s.phase === "aim") {
      s.aimX = Math.max(-100, Math.min(100, s.aimX + dir * 14));
      s.ballX = 180 + s.aimX * 0.4;
    } else if (s.type === "bowling" && s.phase === "aim") {
      s.aimX = Math.max(-55, Math.min(55, s.aimX + dir * 10));
      s.ballX = 180 + s.aimX;
    }
  }

  function setKeeperFromClientX(clientX) {
    if (mode !== "save" || !saveState || saveState.resolved || saveState.howto) return;
    const s = saveState;
    const rect = saveCanvas.getBoundingClientRect();
    const scaleX = saveCanvas.width / rect.width;
    const canvasX = (clientX - rect.left) * scaleX;
    const rel = canvasX - saveCanvas.width / 2;

    if (s.type === "penalty") {
      s.keeperX = Math.max(-110, Math.min(110, rel));
    } else if (s.type === "basketball" && s.phase === "aim") {
      s.aimX = Math.max(-90, Math.min(90, rel));
      s.ballX = 180 + s.aimX * 0.35;
    } else if (s.type === "cans" && s.phase === "aim") {
      s.aimX = Math.max(-100, Math.min(100, rel));
      s.ballX = 180 + s.aimX * 0.4;
    } else if (s.type === "bowling" && s.phase === "aim") {
      s.aimX = Math.max(-55, Math.min(55, rel));
      s.ballX = 180 + s.aimX;
    }
  }

  function drawNeuer(c, x, y, scale = 1, rot = 0) {
    const w = BIRD_DRAW_W * scale;
    const h = BIRD_DRAW_H * scale;

    c.save();
    c.translate(x, y);
    c.rotate(rot);

    if (playerImg.complete && playerImg.naturalWidth > 0) {
      c.drawImage(playerImg, -w / 2, -h / 2, w, h);
    } else {
      c.fillStyle = "#111";
      c.beginPath();
      c.ellipse(0, 0, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#1a3a4a");
    sky.addColorStop(0.55, "#2d6a4f");
    sky.addColorStop(1, "#1f7a48");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(244,232,193,0.05)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(120, GROUND);
    ctx.lineTo(40, GROUND);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W - 120, GROUND);
    ctx.lineTo(W - 40, GROUND);
    ctx.closePath();
    ctx.fill();

    clouds.forEach((cl) => {
      cl.x -= 0.35;
      if (cl.x < -80) cl.x = W + 40;
      ctx.fillStyle = "rgba(247,244,239,0.12)";
      ctx.beginPath();
      ctx.ellipse(cl.x, cl.y, 36 * cl.s, 14 * cl.s, 0, 0, Math.PI * 2);
      ctx.ellipse(cl.x + 22 * cl.s, cl.y + 4, 28 * cl.s, 12 * cl.s, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(247,244,239,0.15)";
    ctx.lineWidth = 2;
    for (let y = 80; y < GROUND; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#0d3d24";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#145a32";
    ctx.fillRect(0, GROUND, W, 8);

    ctx.fillStyle = "#1a2230";
    ctx.fillRect(0, GROUND + 8, W, H - GROUND - 8);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#c8102e" : "#f7f4ef";
      ctx.fillRect(i * 25, GROUND + 14, 22, 8);
    }
  }

  function drawPipe(p) {
    const drawPost = (x, y, h, flip) => {
      ctx.fillStyle = "#f7f4ef";
      ctx.fillRect(x, y, PIPE_W, h);
      ctx.fillStyle = "#d9d3c7";
      ctx.fillRect(x + 8, y, 8, h);
      ctx.fillStyle = "#c8102e";
      if (flip) {
        ctx.fillRect(x - 4, y + h - 18, PIPE_W + 8, 18);
      } else {
        ctx.fillRect(x - 4, y, PIPE_W + 8, 18);
      }
      ctx.strokeStyle = "rgba(10,18,16,0.2)";
      ctx.lineWidth = 1;
      for (let i = y + 20; i < y + h - 10; i += 14) {
        ctx.beginPath();
        ctx.moveTo(x + 4, i);
        ctx.lineTo(x + PIPE_W - 4, i);
        ctx.stroke();
      }
    };

    drawPost(p.x, 0, p.top, true);
    drawPost(p.x, p.bottom, GROUND - p.bottom, false);
  }

  function hitPipe(p) {
    const bx = BIRD_X;
    const by = bird.y;
    const r = bird.r - 2;
    if (bx + r > p.x && bx - r < p.x + PIPE_W) {
      if (by - r < p.top || by + r > p.bottom) return true;
    }
    return false;
  }

  function updatePlay() {
    frame += 1;
    if (maxCheat) {
      bird.y = H / 2;
      bird.vy = 0;
      bird.rot = 0;
    } else {
      bird.vy += GRAVITY;
      bird.y += bird.vy;
      bird.rot = Math.max(-0.6, Math.min(1.1, bird.vy * 0.06));
    }

    if (scareArmed && !scareDone) {
      scareTimer -= 1;
      if (scareTimer <= 0) {
        triggerJumpscare(() => {
          mode = "play";
          hud.hidden = false;
          loop();
        });
        return;
      }
    }

    if (!maxCheat && (bird.y + bird.r > GROUND || bird.y - bird.r < 0)) {
      gameOver();
      return;
    }

    for (const p of pipes) {
      p.x -= PIPE_SPEED;
      if (!p.scored && p.x + PIPE_W < BIRD_X) {
        p.scored = true;
        score += 1;
        scoreEl.textContent = String(score);
        if (score === pendingSaveAt) {
          cancelAnimationFrame(raf);
          beginSaveChallenge();
          saveLoop();
          return;
        }
      }
      if (!maxCheat && hitPipe(p)) {
        gameOver();
        return;
      }
    }

    pipes = pipes.filter((p) => p.x > -PIPE_W - 10);
    if (pipes.length && pipes[pipes.length - 1].x < W - 220) {
      spawnPipe();
    }
  }

  function drawPlay() {
    drawBackground();
    pipes.forEach(drawPipe);
    drawNeuer(ctx, BIRD_X, bird.y, 1, bird.rot);

    if (score > 0 && pendingSaveAt - score <= 2 && mode === "play") {
      ctx.fillStyle = "rgba(232,197,71,0.9)";
      ctx.font = '600 12px "DM Sans", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(`Minispiel in ${pendingSaveAt - score}`, W / 2, 48);
    }
  }

  function loop() {
    if (mode !== "play") return;
    updatePlay();
    if (mode !== "play") {
      drawPlay();
      return;
    }
    drawPlay();
    raf = requestAnimationFrame(loop);
  }

  function saveLoop() {
    if (mode !== "save") return;
    updateSave();
    drawSave();
    raf = requestAnimationFrame(saveLoop);
  }

  function onPointer(e) {
    if (mode === "scare") return;
    if (mode === "play") {
      e.preventDefault();
      flap();
      return;
    }
    if (mode === "save" && saveState && !saveState.resolved) {
      e.preventDefault();
      if (saveState.howto) {
        dismissHowto();
        return;
      }
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const aimThrow = ["basketball", "cans", "bowling"];
      const aimOnly = ["penalty", ...aimThrow];
      if (aimOnly.includes(saveState.type)) {
        setKeeperFromClientX(clientX);
      }
      // Touch: bei Zielspielen erst zielen, Aktion kommt bei touchend
      if (e.touches && aimThrow.includes(saveState.type)) return;
      if (saveState.type !== "penalty") {
        miniAction();
      }
    }
  }

  function onPointerUp(e) {
    if (mode !== "save" || !saveState || saveState.resolved) return;
    if (saveState.howto) {
      e.preventDefault();
      dismissHowto();
      return;
    }
    const aimThrow = ["basketball", "cans", "bowling"];
    if (!aimThrow.includes(saveState.type)) return;
    if (!e.changedTouches) return;
    e.preventDefault();
    miniAction();
  }

  function onPointerMove(e) {
    if (mode !== "save" || !saveState || saveState.resolved || saveState.howto) return;
    const aimTypes = ["penalty", "basketball", "cans", "bowling"];
    if (!aimTypes.includes(saveState.type)) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setKeeperFromClientX(clientX);
  }

  window.addEventListener("keydown", (e) => {
    if (mode === "scare" || mode === "gate" || mode === "denied") {
      e.preventDefault();
      return;
    }
    if (mode === "play") tryMaxCheat(e.code);
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (mode === "start" || mode === "over") startGame();
      else if (mode === "play") flap();
      else if (mode === "save") miniAction();
    }
    if (mode === "save") {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        miniMoveAim(-1);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        miniMoveAim(1);
      }
    }
  });

  canvas.addEventListener("mousedown", onPointer);
  canvas.addEventListener("touchstart", onPointer, { passive: false });
  saveCanvas.addEventListener("mousedown", onPointer);
  saveCanvas.addEventListener("mousemove", onPointerMove);
  saveCanvas.addEventListener("touchstart", onPointer, { passive: false });
  saveCanvas.addEventListener("touchmove", onPointerMove, { passive: false });
  saveCanvas.addEventListener("touchend", onPointerUp, { passive: false });

  saveScreen.addEventListener("click", (e) => {
    if (mode !== "save" || !saveState || !saveState.howto) return;
    if (e.target === saveCanvas) return;
    dismissHowto();
  });

  btnGateYes.addEventListener("click", passGate);
  btnGateNo.addEventListener("click", denyGate);
  btnStart.addEventListener("click", startGame);
  btnRetry.addEventListener("click", startGame);

  function drawIdle() {
    drawBackground();
    drawNeuer(ctx, BIRD_X, H / 2 + Math.sin(Date.now() / 400) * 8, 1, 0);
    if (mode === "start" || mode === "gate") requestAnimationFrame(drawIdle);
  }

  playerImg.onload = () => {
    if (mode === "start" || mode === "gate") drawIdle();
  };
  drawIdle();
})();
