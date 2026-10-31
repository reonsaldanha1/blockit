/**
 * ==============================================================================
 * blockWho · Focus & App Lockdown Engine
 * Exact Material 3 OLED Design System (#131315 Pitch Black, Stark White, Crimson Eject)
 * Pure Zero-Bypass Digital Detox Platform
 * ==============================================================================
 */

(function () {
  'use strict';

  // ==========================================
  // 1. DATA STATE & PERSISTENCE
  // ==========================================
  const STORAGE_KEY = 'blockwho_app_state_v2';

  const DEFAULT_STATE = {
    currentMinutes: 60,
    selectedMode: 'work',
    parachutesCount: 1,
    isLocked: false,
    lockSecondsRemaining: 0,
    lockTotalSeconds: 0,
    lockEndTime: null,
    activeTab: 'focus',
    hapticsEnabled: true,
    audioEnabled: true,
    strictMode: true,
    
    // The Suitcase Whitelisted Items - User custom-added apps only (Focus Soundscape is permanent default in lockdown)
    suitcaseApps: [],

    // The Tower (Habit Skyscraper) - starts empty with zero floors
    tower: {
      streakDays: 0,
      floorsCount: 0,
      totalFocusHours: 0,
      floors: []
    },

    // Scheduled Routines - all disabled by default
    routines: [
      { id: 'r1', name: 'Morning Deep Work', time: '09:00', duration: 90, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], active: false },
      { id: 'r2', name: 'Afternoon Study Sprint', time: '14:30', duration: 45, days: ['Mon', 'Tue', 'Wed', 'Thu'], active: false },
      { id: 'r3', name: 'Night Sleep Sanctuary', time: '23:00', duration: 180, days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], active: false }
    ],

    scratchpadContent: "blockWho Focus Principles:\n1. Zero bypass allowed until timer reaches zero.\n2. Protect dopamine reservoirs.\n3. The Emergency Eject is for true emergencies only.\n"
  };

  const REMOVED_BUILTIN_IDS = new Set(['calc', 'scratchpad', 'maps', 'phone', 'reader', 'camera', 'audio']);

  let state = loadState();

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = Object.assign({}, DEFAULT_STATE, parsed);
        if (Array.isArray(merged.suitcaseApps)) {
          // Cleanly remove any built-in tools from user-manageable suitcase (Focus Soundscape is default in lockdown)
          merged.suitcaseApps = merged.suitcaseApps.filter(a => !REMOVED_BUILTIN_IDS.has(a.id));
        }
        return merged;
      }
    } catch (e) {
      console.warn('Could not read saved state, resetting to default:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  // ==========================================
  // HAPTIC FEEDBACK & NATIVE VIBRATION
  // ==========================================
  function hapticFeedback(ms = 20) {
    if (state.hapticsEnabled === false) return;
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
        window.AndroidBridge.vibrate(ms);
      } else if (navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch (e) {}
  }

  // ==========================================
  // 2. SOUNDSCAPE SYNTHESIZER (WEB AUDIO API)
  // ==========================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.isPlaying = false;
      this.currentSound = 'binaural';
      this.nodes = [];
      this.volume = 0.5;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, val));
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      }
    }

    startSoundscape(soundType) {
      this.init();
      this.stopSoundscape();
      if (soundType) this.currentSound = soundType;
      this.isPlaying = true;
      const t = this.ctx.currentTime;

      if (this.currentSound === 'binaural') {
        // 40Hz Gamma Focus Binaural Beat (Left 200Hz, Right 240Hz)
        const merger = this.ctx.createChannelMerger(2);

        const oscL = this.ctx.createOscillator();
        oscL.type = 'sine';
        oscL.frequency.setValueAtTime(200, t);
        const gainL = this.ctx.createGain();
        gainL.gain.setValueAtTime(0.25, t);
        oscL.connect(gainL);
        gainL.connect(merger, 0, 0);

        const oscR = this.ctx.createOscillator();
        oscR.type = 'sine';
        oscR.frequency.setValueAtTime(240, t);
        const gainR = this.ctx.createGain();
        gainR.gain.setValueAtTime(0.25, t);
        oscR.connect(gainR);
        gainR.connect(merger, 0, 1);

        merger.connect(this.masterGain);
        oscL.start();
        oscR.start();
        this.nodes.push(oscL, oscR, gainL, gainR, merger);

      } else if (this.currentSound === 'brown') {
        // Deep Cabin Brown Noise
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, t);

        source.connect(filter);
        filter.connect(this.masterGain);
        source.start();
        this.nodes.push(source, filter);

      } else if (this.currentSound === 'rain') {
        // Gentle Rain Noise
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, t);
        filter.Q.setValueAtTime(1.2, t);

        const subFilter = this.ctx.createBiquadFilter();
        subFilter.type = 'lowpass';
        subFilter.frequency.setValueAtTime(4500, t);

        source.connect(filter);
        filter.connect(subFilter);
        subFilter.connect(this.masterGain);
        source.start();
        this.nodes.push(source, filter, subFilter);

      } else {
        // Pure White Noise
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.35;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(7500, t);

        source.connect(filter);
        filter.connect(this.masterGain);
        source.start();
        this.nodes.push(source, filter);
      }
    }

    stopSoundscape() {
      this.nodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch (e) {}
      });
      this.nodes = [];
      this.isPlaying = false;
    }

    playChime(type = 'success') {
      if (state.audioEnabled === false) return;
      try {
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (type === 'success') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, t); // D5
          osc.frequency.exponentialRampToValueAtTime(880.00, t + 0.15); // A5
          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(t + 0.5);
        } else if (type === 'lock') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, t);
          osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(t + 0.4);
        } else if (type === 'alert') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(320, t);
          osc.frequency.setValueAtTime(220, t + 0.15);
          gain.gain.setValueAtTime(0.35, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(t + 0.4);
        } else if (type === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, t);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(t + 0.05);
        } else if (type === 'futuristic-plus') {
          // Ascending dual-tone futuristic laser sweep
          osc.type = 'sine';
          osc.frequency.setValueAtTime(540, t);
          osc.frequency.exponentialRampToValueAtTime(1180, t + 0.12);
          gain.gain.setValueAtTime(0.24, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(t + 0.18);

          try {
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1080, t);
            osc2.frequency.exponentialRampToValueAtTime(1620, t + 0.08);
            gain2.gain.setValueAtTime(0.1, t);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start();
            osc2.stop(t + 0.12);
          } catch (e2) {}
        } else if (type === 'futuristic-minus') {
          // Descending resonant power dampening blip
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, t);
          osc.frequency.exponentialRampToValueAtTime(420, t + 0.12);
          gain.gain.setValueAtTime(0.22, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(t + 0.18);
        } else if (type === 'tab-switch') {
          // Futuristic sleek interface micro-tick
          osc.type = 'sine';
          osc.frequency.setValueAtTime(620, t);
          osc.frequency.exponentialRampToValueAtTime(940, t + 0.06);
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(t + 0.08);
        } else if (type === 'lock-heavy') {
          // Deep cinematic sub-bass impact boom
          const subOsc = this.ctx.createOscillator();
          const subGain = this.ctx.createGain();
          subOsc.type = 'sine';
          subOsc.frequency.setValueAtTime(110, t);
          subOsc.frequency.exponentialRampToValueAtTime(26, t + 0.65);
          subGain.gain.setValueAtTime(0.5, t);
          subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
          subOsc.connect(subGain);
          subGain.connect(this.ctx.destination);
          subOsc.start();
          subOsc.stop(t + 0.65);

          // Metallic mechanical latch slam
          const latchOsc = this.ctx.createOscillator();
          const latchGain = this.ctx.createGain();
          latchOsc.type = 'triangle';
          latchOsc.frequency.setValueAtTime(880, t);
          latchOsc.frequency.exponentialRampToValueAtTime(180, t + 0.28);
          latchGain.gain.setValueAtTime(0.35, t);
          latchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          latchOsc.connect(latchGain);
          latchGain.connect(this.ctx.destination);
          latchOsc.start();
          latchOsc.stop(t + 0.28);
        } else if (type === 'victory-fanfare') {
          // Uplifting victory harmonic arpeggio
          const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
          notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const noteTime = t + (idx * 0.12);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteTime);
            gain.gain.setValueAtTime(0.24, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.7);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(noteTime);
            osc.stop(noteTime + 0.7);
          });
        }
      } catch (e) {
        console.warn('Audio chime suppressed:', e);
      }
    }

    playDTMF(digit) {
      if (state.audioEnabled === false) return;
      try {
        this.init();
        const dtmfMap = {
          '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
          '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
          '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
          '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
        };
        const freqs = dtmfMap[digit] || [440, 440];
        const t = this.ctx.currentTime;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.frequency.setValueAtTime(freqs[0], t);
        osc2.frequency.setValueAtTime(freqs[1], t);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(t + 0.12);
        osc2.stop(t + 0.12);
      } catch (e) {}
    }
  }

  const sound = new SoundEngine();

  // Unlock AudioContext on first user interaction
  window.addEventListener('click', () => sound.init(), { once: true });
  window.addEventListener('touchstart', () => sound.init(), { once: true });

  // ==========================================
  // 3. SCREEN 1: FOCUS ROTARY DIAL
  // ==========================================
  const dialSvg = document.getElementById('timer-dial');
  const progressArc = document.getElementById('progress-arc');
  const dialKnob = document.getElementById('dial-knob');
  const dialKnobCore = document.getElementById('dial-knob-core');
  const durationDisplay = document.getElementById('display-duration');
  const endTimeDisplay = document.getElementById('display-end-time');

  const CIRCLE_RADIUS = 112;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // 703.716
  const MAX_MINUTES = 180; // 3 Hours max on standard dial cycle

  function generateDialTicks() {
    const ticksGroup = document.getElementById('dial-ticks');
    if (!ticksGroup) return;
    ticksGroup.innerHTML = '';

    const TOTAL_TICKS = 48;
    for (let i = 0; i < TOTAL_TICKS; i++) {
      const angleDeg = (i / TOTAL_TICKS) * 360;
      const angleRad = (angleDeg * Math.PI) / 180;
      const isMajor = i % 4 === 0;

      const rInner = isMajor ? 122 : 124;
      const rOuter = 127;

      const x1 = 140 + rInner * Math.cos(angleRad);
      const y1 = 140 + rInner * Math.sin(angleRad);
      const x2 = 140 + rOuter * Math.cos(angleRad);
      const y2 = 140 + rOuter * Math.sin(angleRad);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('stroke', isMajor ? '#ffffff' : '#6b7280');
      line.setAttribute('stroke-width', isMajor ? '1.5' : '0.8');
      line.setAttribute('opacity', isMajor ? '0.7' : '0.35');
      ticksGroup.appendChild(line);
    }
  }

  function updateTimerInterface() {
    const mins = state.currentMinutes;
    const fraction = Math.min(1, Math.max(0, mins / MAX_MINUTES));

    // Update Arc Stroke Offset
    const offset = CIRCLE_CIRCUMFERENCE * (1 - fraction);
    if (progressArc) {
      progressArc.style.strokeDasharray = CIRCLE_CIRCUMFERENCE.toFixed(1);
      progressArc.style.strokeDashoffset = offset.toFixed(1);
    }

    // Update Knob Indicator Coordinates (Dial SVG is rotated -90deg, 0 rad is at Top)
    const angleRad = fraction * 2 * Math.PI;
    const knobX = 140 + CIRCLE_RADIUS * Math.cos(angleRad);
    const knobY = 140 + CIRCLE_RADIUS * Math.sin(angleRad);

    if (dialKnob) {
      dialKnob.setAttribute('cx', knobX.toFixed(2));
      dialKnob.setAttribute('cy', knobY.toFixed(2));
    }
    if (dialKnobCore) {
      dialKnobCore.setAttribute('cx', knobX.toFixed(2));
      dialKnobCore.setAttribute('cy', knobY.toFixed(2));
    }

    // Formatted Text Displays
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    const formatted = `${String(hours).padStart(2, '0')}:${String(remainingMins).padStart(2, '0')}`;
    if (durationDisplay) durationDisplay.innerText = formatted;

    // Calculate End Time
    const targetDate = new Date(Date.now() + mins * 60 * 1000);
    const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (endTimeDisplay) endTimeDisplay.innerText = `UNTIL ${timeStr}`;

    // Update Suitcase Fraction in Card
    const packedCount = state.suitcaseApps.filter(a => a.packed).length;
    const totalApps = state.suitcaseApps.length;
    const fractionEl = document.getElementById('focus-suitcase-fraction');
    if (fractionEl) fractionEl.innerText = `${packedCount}/${totalApps}`;

    // Update Preset Pills Highlight & Custom Pill State
    let isPresetMatched = false;
    document.querySelectorAll('.preset-pill').forEach(btn => {
      const pMins = parseInt(btn.getAttribute('data-mins'), 10);
      if (pMins === mins) {
        isPresetMatched = true;
        btn.classList.add('bg-primary', 'text-on-primary', 'font-semibold');
        btn.classList.remove('bg-surface-container-low', 'text-on-surface-variant');
      } else {
        btn.classList.remove('bg-primary', 'text-on-primary', 'font-semibold');
        btn.classList.add('bg-surface-container-low', 'text-on-surface-variant');
      }
    });

    const customPill = document.getElementById('btn-open-custom-time');
    if (customPill) {
      if (!isPresetMatched) {
        customPill.classList.add('bg-primary', 'text-on-primary', 'font-semibold', 'border-primary');
        customPill.classList.remove('bg-surface-container-high', 'text-primary', 'border-white/10');
      } else {
        customPill.classList.remove('bg-primary', 'text-on-primary', 'font-semibold', 'border-primary');
        customPill.classList.add('bg-surface-container-high', 'text-primary', 'border-white/10');
      }
    }
  }

  function setTime(mins, playSound = true) {
    state.currentMinutes = Math.min(720, Math.max(5, mins));
    saveState();
    updateTimerInterface();
    if (playSound) {
      sound.playChime('click');
      hapticFeedback(15);
    }
  }

  function triggerFuturisticStepperAnimation(deltaMins, btnEl) {
    const isPlus = deltaMins > 0;
    
    // 1. Shockwave Ripple ring on button
    if (btnEl) {
      const ring = document.createElement('div');
      ring.className = isPlus ? 'shockwave-ring' : 'shockwave-ring-minus';
      btnEl.appendChild(ring);
      setTimeout(() => ring.remove(), 600);

      // Icon micro-rotation / kinetic bounce
      const icon = btnEl.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.style.transform = isPlus ? 'rotate(90deg) scale(1.2)' : 'scale(0.8)';
        setTimeout(() => { icon.style.transform = ''; }, 220);
      }
    }

    // 2. Holographic Floating Delta Particle (+15m / -15m)
    const particlesContainer = document.getElementById('stepper-particles-container');
    const rotaryContainer = document.getElementById('rotary-container');
    if (particlesContainer && btnEl && rotaryContainer) {
      const btnRect = btnEl.getBoundingClientRect();
      const parentRect = rotaryContainer.getBoundingClientRect();

      const particle = document.createElement('div');
      particle.className = isPlus ? 'holo-particle-plus' : 'holo-particle-minus';
      particle.innerText = isPlus ? `+${deltaMins}m` : `${deltaMins}m`;

      // Position relative to rotary container
      const x = (btnRect.left + btnRect.width / 2) - parentRect.left;
      const y = (btnRect.top + btnRect.height / 2) - parentRect.top;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      particlesContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 700);
    }

    // 3. Center Display Glitch / Neon Pulse
    if (durationDisplay) {
      durationDisplay.classList.remove('anim-cyber-pulse');
      void durationDisplay.offsetWidth; // Force reflow
      durationDisplay.classList.add('anim-cyber-pulse');
    }

    // 4. Progress Arc Laser Surge
    if (progressArc) {
      progressArc.classList.remove('anim-arc-surge');
      void progressArc.offsetWidth; // Force reflow
      progressArc.classList.add('anim-arc-surge');
      setTimeout(() => progressArc.classList.remove('anim-arc-surge'), 500);
    }

    // 5. Sci-Fi Synthesizer Sound & Haptics
    sound.playChime(isPlus ? 'futuristic-plus' : 'futuristic-minus');
    hapticFeedback(18);
  }

  function adjustTime(deltaMins, btnEl) {
    const newMins = state.currentMinutes + deltaMins;
    setTime(newMins, false);
    triggerFuturisticStepperAnimation(deltaMins, btnEl);
  }

  // Dial Drag / Pointer Interaction
  let isDraggingDial = false;

  function handleDialPointer(e) {
    if (!dialSvg) return;
    const rect = dialSvg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Angle in degrees clockwise from 12 o'clock
    let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angleDeg < 0) angleDeg += 360;

    let computedMins = Math.round((angleDeg / 360) * MAX_MINUTES);
    // Snap to 5-minute increments
    computedMins = Math.round(computedMins / 5) * 5;
    if (computedMins === 0) computedMins = 5;

    if (computedMins !== state.currentMinutes) {
      state.currentMinutes = computedMins;
      saveState();
      updateTimerInterface();
      hapticFeedback(10);
    }
  }

  if (dialSvg) {
    dialSvg.addEventListener('mousedown', (e) => {
      isDraggingDial = true;
      handleDialPointer(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isDraggingDial) handleDialPointer(e);
    });
    window.addEventListener('mouseup', () => {
      isDraggingDial = false;
    });

    dialSvg.addEventListener('touchstart', (e) => {
      isDraggingDial = true;
      handleDialPointer(e);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (isDraggingDial) handleDialPointer(e);
    }, { passive: false });
    window.addEventListener('touchend', () => {
      isDraggingDial = false;
    });
  }

  // Steppers with futuristic animation
  const btnMinus = document.getElementById('btn-dial-minus');
  const btnPlus = document.getElementById('btn-dial-plus');
  if (btnMinus) btnMinus.addEventListener('click', () => adjustTime(-15, btnMinus));
  if (btnPlus) btnPlus.addEventListener('click', () => adjustTime(15, btnPlus));

  // ==========================================
  // CUSTOM TIME PICKER MODAL CONTROLLER
  // ==========================================
  const modalCustomTime = document.getElementById('modal-custom-time');
  const btnOpenCustomTime = document.getElementById('btn-open-custom-time');
  const btnCustomTimeCenter = document.getElementById('btn-custom-time-center');
  const btnCloseCustomTime = document.getElementById('btn-close-custom-time');
  const btnCancelCustomTime = document.getElementById('btn-cancel-custom-time');
  const btnApplyCustomTime = document.getElementById('btn-apply-custom-time');

  const inputCustomH = document.getElementById('custom-input-hours');
  const inputCustomM = document.getElementById('custom-input-mins');
  const btnHUp = document.getElementById('custom-h-up');
  const btnHDown = document.getElementById('custom-h-down');
  const btnMUp = document.getElementById('custom-m-up');
  const btnMDown = document.getElementById('custom-m-down');
  const customSummary = document.getElementById('custom-total-summary');
  const customCalculatedEnd = document.getElementById('custom-calculated-end');
  const customTowerHint = document.getElementById('custom-tower-hint');
  const customTowerHintText = document.getElementById('custom-tower-hint-text');

  function openCustomTimeModal() {
    if (!modalCustomTime) return;
    const currentMins = state.currentMinutes || 60;
    const h = Math.floor(currentMins / 60);
    const m = currentMins % 60;

    if (inputCustomH) inputCustomH.value = h;
    if (inputCustomM) inputCustomM.value = m;

    updateCustomModalPreview();
    modalCustomTime.classList.remove('hidden');
    modalCustomTime.classList.add('flex');
    sound.playChime('click');
    hapticFeedback(15);
  }

  function closeCustomTimeModal() {
    if (!modalCustomTime) return;
    modalCustomTime.classList.add('hidden');
    modalCustomTime.classList.remove('flex');
  }

  function getCustomModalMinutes() {
    const h = Math.max(0, parseInt(inputCustomH ? inputCustomH.value : '0', 10) || 0);
    const m = Math.max(0, parseInt(inputCustomM ? inputCustomM.value : '0', 10) || 0);
    let total = h * 60 + m;
    if (total < 5) total = 5;
    if (total > 720) total = 720; // 12 hours max
    return total;
  }

  function updateCustomModalPreview() {
    const total = getCustomModalMinutes();
    const h = Math.floor(total / 60);
    const m = total % 60;

    if (customSummary) {
      if (h > 0 && m > 0) {
        customSummary.innerText = `Total: ${h}h ${m}m (${total} mins)`;
      } else if (h > 0) {
        customSummary.innerText = `Total: ${h}h (${total} mins)`;
      } else {
        customSummary.innerText = `Total: ${m} mins`;
      }
    }

    if (customCalculatedEnd) {
      const targetDate = new Date(Date.now() + total * 60 * 1000);
      const timeStr = targetDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      customCalculatedEnd.innerText = `Ends ~${timeStr}`;
    }

    if (customTowerHint && customTowerHintText) {
      if (total >= 180) {
        customTowerHint.className = 'w-full py-1.5 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-400 flex items-center gap-1.5 transition-colors';
        customTowerHintText.innerText = '★ Qualifies to build Tower floor (3h threshold met)';
      } else {
        const remaining = (180 - total) / 60;
        customTowerHint.className = 'w-full py-1.5 px-3 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-primary flex items-center gap-1.5 transition-colors';
        customTowerHintText.innerText = `Need ${remaining.toFixed(1)}h more to construct a Tower floor`;
      }
    }
  }

  if (btnOpenCustomTime) btnOpenCustomTime.addEventListener('click', openCustomTimeModal);
  if (btnCustomTimeCenter) btnCustomTimeCenter.addEventListener('click', openCustomTimeModal);
  if (btnCloseCustomTime) btnCloseCustomTime.addEventListener('click', closeCustomTimeModal);
  if (btnCancelCustomTime) btnCancelCustomTime.addEventListener('click', closeCustomTimeModal);
  if (modalCustomTime) {
    modalCustomTime.addEventListener('click', (e) => {
      if (e.target === modalCustomTime) closeCustomTimeModal();
    });
  }

  if (btnHUp) {
    btnHUp.addEventListener('click', () => {
      if (!inputCustomH) return;
      let val = (parseInt(inputCustomH.value, 10) || 0) + 1;
      if (val > 12) val = 12;
      inputCustomH.value = val;
      updateCustomModalPreview();
      sound.playChime('click');
      hapticFeedback(12);
    });
  }

  if (btnHDown) {
    btnHDown.addEventListener('click', () => {
      if (!inputCustomH) return;
      let val = (parseInt(inputCustomH.value, 10) || 0) - 1;
      if (val < 0) val = 0;
      inputCustomH.value = val;
      updateCustomModalPreview();
      sound.playChime('click');
      hapticFeedback(12);
    });
  }

  if (btnMUp) {
    btnMUp.addEventListener('click', () => {
      if (!inputCustomM) return;
      let val = (parseInt(inputCustomM.value, 10) || 0) + 5;
      if (val >= 60) {
        val = 0;
        if (inputCustomH) {
          let hVal = (parseInt(inputCustomH.value, 10) || 0) + 1;
          if (hVal <= 12) inputCustomH.value = hVal;
        }
      }
      inputCustomM.value = val;
      updateCustomModalPreview();
      sound.playChime('click');
      hapticFeedback(12);
    });
  }

  if (btnMDown) {
    btnMDown.addEventListener('click', () => {
      if (!inputCustomM) return;
      let val = (parseInt(inputCustomM.value, 10) || 0) - 5;
      if (val < 0) {
        val = 55;
        if (inputCustomH) {
          let hVal = (parseInt(inputCustomH.value, 10) || 0) - 1;
          if (hVal >= 0) inputCustomH.value = hVal;
        }
      }
      inputCustomM.value = val;
      updateCustomModalPreview();
      sound.playChime('click');
      hapticFeedback(12);
    });
  }

  if (inputCustomH) {
    inputCustomH.addEventListener('input', updateCustomModalPreview);
    inputCustomH.addEventListener('change', () => {
      let val = parseInt(inputCustomH.value, 10) || 0;
      inputCustomH.value = Math.min(12, Math.max(0, val));
      updateCustomModalPreview();
    });
  }

  if (inputCustomM) {
    inputCustomM.addEventListener('input', updateCustomModalPreview);
    inputCustomM.addEventListener('change', () => {
      let val = parseInt(inputCustomM.value, 10) || 0;
      inputCustomM.value = Math.min(59, Math.max(0, val));
      updateCustomModalPreview();
    });
  }

  document.querySelectorAll('.custom-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const h = parseInt(chip.getAttribute('data-hours'), 10) || 0;
      const m = parseInt(chip.getAttribute('data-mins'), 10) || 0;
      if (inputCustomH) inputCustomH.value = h;
      if (inputCustomM) inputCustomM.value = m;
      updateCustomModalPreview();
      sound.playChime('click');
      hapticFeedback(15);
    });
  });

  if (btnApplyCustomTime) {
    btnApplyCustomTime.addEventListener('click', () => {
      const totalMins = getCustomModalMinutes();
      setTime(totalMins, false);
      closeCustomTimeModal();

      // Trigger visual confirmation bloom on main duration display
      if (durationDisplay) {
        durationDisplay.classList.remove('anim-cyber-pulse');
        void durationDisplay.offsetWidth;
        durationDisplay.classList.add('anim-cyber-pulse');
      }
      if (progressArc) {
        progressArc.classList.remove('anim-arc-surge');
        void progressArc.offsetWidth;
        progressArc.classList.add('anim-arc-surge');
        setTimeout(() => progressArc.classList.remove('anim-arc-surge'), 500);
      }
      sound.playChime('success');
      hapticFeedback(30);
    });
  }

  // Presets
  document.querySelectorAll('.preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.getAttribute('data-mins'), 10);
      setTime(mins);
    });
  });

  // ==========================================
  // DYNAMIC ATMOSPHERE & DARKEN THEME CONTROLLER
  // ==========================================
  function updateThemeAtmosphere(mode, isLocked = false) {
    const ambientLayer = document.getElementById('ambient-theme-layer');
    const mobileFrame = document.getElementById('mobile-frame');
    const dialGlow = document.getElementById('dial-atmospheric-glow');

    if (isLocked) {
      if (mobileFrame) {
        mobileFrame.classList.add('theme-lockdown-dark');
      }
      if (ambientLayer) {
        ambientLayer.style.background = 'radial-gradient(circle at 50% 25%, rgba(239, 68, 68, 0.07) 0%, rgba(5, 5, 7, 0.92) 65%, rgba(2, 2, 3, 0.98) 100%)';
      }
      if (dialGlow) {
        dialGlow.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
      }
      return;
    }

    if (mobileFrame) {
      mobileFrame.classList.remove('theme-lockdown-dark');
    }

    if (mode === 'study') {
      if (ambientLayer) {
        ambientLayer.style.background = 'radial-gradient(circle at 50% 18%, rgba(0, 229, 255, 0.05) 0%, rgba(19, 19, 21, 0) 70%)';
      }
      if (dialGlow) {
        dialGlow.style.backgroundColor = 'rgba(0, 229, 255, 0.08)';
      }
    } else if (mode === 'work') {
      if (ambientLayer) {
        ambientLayer.style.background = 'radial-gradient(circle at 50% 18%, rgba(139, 92, 246, 0.06) 0%, rgba(19, 19, 21, 0) 70%)';
      }
      if (dialGlow) {
        dialGlow.style.backgroundColor = 'rgba(139, 92, 246, 0.08)';
      }
    } else if (mode === 'sleep') {
      if (ambientLayer) {
        ambientLayer.style.background = 'radial-gradient(circle at 50% 18%, rgba(255, 183, 77, 0.03) 0%, rgba(10, 10, 13, 0.8) 75%)';
      }
      if (dialGlow) {
        dialGlow.style.backgroundColor = 'rgba(255, 183, 77, 0.04)';
      }
    }
  }

  // Mode Switcher
  function switchMode(mode) {
    state.selectedMode = mode;
    saveState();
    updateThemeAtmosphere(mode, state.isLocked);
    state.selectedMode = mode;
    saveState();

    const modes = ['study', 'work', 'sleep'];
    modes.forEach(m => {
      const btn = document.getElementById(`mode-${m}`);
      if (!btn) return;
      if (m === mode) {
        btn.classList.add('bg-surface-container-highest', 'text-primary');
        btn.classList.remove('text-outline');
      } else {
        btn.classList.remove('bg-surface-container-highest', 'text-primary');
        btn.classList.add('text-outline');
      }
    });

    const quoteEl = document.getElementById('mode-quote');
    const badgeEl = document.getElementById('session-badge');

    if (mode === 'study') {
      setTime(45);
      if (quoteEl) quoteEl.innerText = 'Deep academic focus';
      if (badgeEl) badgeEl.innerText = 'STRICT 0.9';
    } else if (mode === 'work') {
      setTime(60);
      if (quoteEl) quoteEl.innerText = 'Cognitive flow state';
      if (badgeEl) badgeEl.innerText = 'FLOW ACTIVE';
    } else if (mode === 'sleep') {
      setTime(180);
      if (quoteEl) quoteEl.innerText = 'Night sanctuary · Zero bypass';
      if (badgeEl) badgeEl.innerText = 'SANCTUARY';
    }

    sound.playChime('click');
    hapticFeedback(20);
  }

  ['study', 'work', 'sleep'].forEach(m => {
    const btn = document.getElementById(`mode-${m}`);
    if (btn) btn.addEventListener('click', () => switchMode(m));
  });

  // Pack Suitcase trigger
  const btnPackTrigger = document.getElementById('btn-pack-suitcase-trigger');
  if (btnPackTrigger) {
    btnPackTrigger.addEventListener('click', () => {
      navigateToTab('suitcase');
      sound.playChime('click');
      hapticFeedback(15);
    });
  }

  // ==========================================
  // 4. SCREEN 2: ACTIVE LOCKOUT CONTROLLER
  // ==========================================
  let countdownInterval = null;

  function triggerLockdown() {
    const btn = document.getElementById('lockdown-btn');
    if (!btn) return;
    try { sound.playChime('lock'); } catch (e) {}
    try { hapticFeedback(50); } catch (e) {}

    // Initial state transition
    state.isLocked = true;
    state.lockTotalSeconds = Math.max(60, (state.currentMinutes || 45) * 60);
    state.lockSecondsRemaining = state.lockTotalSeconds;
    state.lockEndTime = Date.now() + (state.lockSecondsRemaining * 1000);
    saveState();

    // === NATIVE BLOCKING LAYER (BlockIt-style) ===
    // Activate the Android AccessibilityService blocking layer.
    // Build the allowed packages list from suitcase apps that have real package names.
    if (window.AndroidBridge && typeof window.AndroidBridge.startBlockingSession === 'function') {
      try {
        const allowedPkgs = state.suitcaseApps
          .filter(a => a.packed && a.pkg)
          .map(a => a.pkg);
        window.AndroidBridge.startBlockingSession(
          state.lockTotalSeconds,
          JSON.stringify(allowedPkgs),
          state.parachutesCount
        );
      } catch (e) {
        console.warn('Failed to start native blocking session:', e);
      }
    }

    try {
      enterLockoutScreen();
    } catch (e) {
      console.error('Error entering lockout screen:', e);
    }
    try {
      startCountdownTimer();
    } catch (e) {
      console.error('Error starting countdown timer:', e);
    }
  }

  // ==========================================
  // LOCKDOWN AUDIO CAPACITOR CHARGE SYNTH
  // ==========================================
  let lockdownChargeOsc = null;
  let lockdownChargeGain = null;

  function startLockdownChargeSound() {
    if (state.audioEnabled === false) return;
    try {
      sound.init();
      const t = sound.ctx.currentTime;
      lockdownChargeOsc = sound.ctx.createOscillator();
      lockdownChargeGain = sound.ctx.createGain();

      lockdownChargeOsc.type = 'sawtooth';
      lockdownChargeOsc.frequency.setValueAtTime(150, t);
      lockdownChargeOsc.frequency.exponentialRampToValueAtTime(850, t + 3.0);

      const filter = sound.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, t);
      filter.frequency.exponentialRampToValueAtTime(2600, t + 3.0);

      lockdownChargeGain.gain.setValueAtTime(0.04, t);
      lockdownChargeGain.gain.linearRampToValueAtTime(0.24, t + 3.0);

      lockdownChargeOsc.connect(filter);
      filter.connect(lockdownChargeGain);
      lockdownChargeGain.connect(sound.ctx.destination);

      lockdownChargeOsc.start();
    } catch (e) {}
  }

  function stopLockdownChargeSound() {
    if (lockdownChargeGain && sound.ctx) {
      try {
        const t = sound.ctx.currentTime;
        lockdownChargeGain.gain.setValueAtTime(lockdownChargeGain.gain.value, t);
        lockdownChargeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        setTimeout(() => {
          if (lockdownChargeOsc) {
            try { lockdownChargeOsc.stop(); } catch (e) {}
            lockdownChargeOsc = null;
            lockdownChargeGain = null;
          }
        }, 90);
      } catch (e) {}
    }
  }

  // ==========================================
  // FULLSCREEN LOCKDOWN PORTAL ANIMATION
  // ==========================================
  function triggerLockdownPortalAnimation() {
    const portal = document.createElement('div');
    portal.className = 'fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none overflow-hidden';
    portal.id = 'lockdown-portal-overlay';
    portal.innerHTML = `
      <!-- Deep Cinematic Blur Background -->
      <div class="absolute inset-0 bg-black/92 backdrop-blur-lg animate-lockdown-bg"></div>

      <!-- Concentric Shockwave Energy Rings -->
      <div class="absolute w-80 h-80 rounded-full border-2 border-primary/90 animate-portal-ring-1"></div>
      <div class="absolute w-80 h-80 rounded-full border border-red-500/80 animate-portal-ring-2"></div>

      <!-- Holographic Reticle & Status Banner -->
      <div class="relative z-10 flex flex-col items-center animate-portal-hud">
        <div class="w-20 h-20 rounded-full bg-surface-container-highest border border-primary/60 flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.45)] mb-3">
          <span class="material-symbols-outlined text-4xl text-primary animate-pulse">lock</span>
        </div>
        <div class="font-label-md text-sm text-primary font-bold tracking-widest uppercase mb-1">SYSTEM ARMED</div>
        <div class="font-label-sm text-[11px] text-outline tracking-wider uppercase">Zero Bypass Protocol Engaged</div>
      </div>
    `;
    document.body.appendChild(portal);
    setTimeout(() => portal.remove(), 1000);
  }

  // ==========================================
  // 3-SECOND HOLD LOCKDOWN CONTROLLER
  // ==========================================
  const lockdownBtn = document.getElementById('lockdown-btn');
  const lockdownHoldProgress = document.getElementById('lockdown-hold-progress');
  const lockdownProgressGlow = document.getElementById('lockdown-progress-glow');
  const lockdownBtnLabel = document.getElementById('lockdown-btn-label');
  const lockdownBtnSublabel = document.getElementById('lockdown-btn-sublabel');
  const lockdownBtnIcon = document.getElementById('lockdown-btn-icon');

  let lockdownHoldTimer = null;
  let lockdownHoldInterval = null;
  let lockdownHoldStartTime = 0;
  const LOCKDOWN_HOLD_DURATION_MS = 3000;

  function startLockdownHold(e) {
    if (e && e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }
    if (state.isLocked) return;

    lockdownHoldStartTime = Date.now();

    // Start progress animations
    if (lockdownHoldProgress) {
      lockdownHoldProgress.style.transition = `width ${LOCKDOWN_HOLD_DURATION_MS}ms linear`;
      lockdownHoldProgress.style.width = '100%';
    }
    if (lockdownProgressGlow) {
      lockdownProgressGlow.style.opacity = '1';
      lockdownProgressGlow.style.transition = `left ${LOCKDOWN_HOLD_DURATION_MS}ms linear`;
      lockdownProgressGlow.style.left = '100%';
    }
    if (lockdownBtn) {
      lockdownBtn.classList.add('ring-2', 'ring-primary/60', 'scale-[0.99]');
    }
    if (lockdownBtnIcon) {
      lockdownBtnIcon.innerText = 'lock_clock';
    }

    startLockdownChargeSound();
    hapticFeedback(25);

    // Live countdown label updater
    if (lockdownHoldInterval) clearInterval(lockdownHoldInterval);
    lockdownHoldInterval = setInterval(() => {
      const elapsed = Date.now() - lockdownHoldStartTime;
      const remainingSec = Math.max(0, ((LOCKDOWN_HOLD_DURATION_MS - elapsed) / 1000)).toFixed(1);
      if (lockdownBtnLabel) {
        lockdownBtnLabel.innerText = `ARMING SHIELD (${remainingSec}s)...`;
      }
      if (lockdownBtnSublabel) {
        lockdownBtnSublabel.innerText = 'Keep Holding To Lock Down';
      }
      // Progressive tactile feedback
      if (elapsed > 1000 && elapsed < 1120) hapticFeedback(15);
      if (elapsed > 2000 && elapsed < 2120) hapticFeedback(25);
      if (elapsed > 2600 && elapsed < 2720) hapticFeedback(40);
    }, 100);

    // Full completion trigger
    lockdownHoldTimer = setTimeout(() => {
      completeLockdownHold();
    }, LOCKDOWN_HOLD_DURATION_MS);
  }

  function cancelLockdownHold() {
    if (!lockdownHoldStartTime) return;
    lockdownHoldStartTime = 0;

    if (lockdownHoldTimer) {
      clearTimeout(lockdownHoldTimer);
      lockdownHoldTimer = null;
    }
    if (lockdownHoldInterval) {
      clearInterval(lockdownHoldInterval);
      lockdownHoldInterval = null;
    }

    stopLockdownChargeSound();

    if (lockdownHoldProgress) {
      lockdownHoldProgress.style.transition = 'width 250ms ease-out';
      lockdownHoldProgress.style.width = '0%';
    }
    if (lockdownProgressGlow) {
      lockdownProgressGlow.style.transition = 'left 250ms ease-out';
      lockdownProgressGlow.style.left = '0%';
      lockdownProgressGlow.style.opacity = '0';
    }
    if (lockdownBtn) {
      lockdownBtn.classList.remove('ring-2', 'ring-primary/60', 'scale-[0.99]');
    }
    if (lockdownBtnLabel) {
      lockdownBtnLabel.innerText = 'HOLD 3S TO ENGAGE';
    }
    if (lockdownBtnSublabel) {
      lockdownBtnSublabel.innerText = 'Strict Zero-Bypass Mode';
    }
    if (lockdownBtnIcon) {
      lockdownBtnIcon.innerText = 'lock';
    }
  }

  function completeLockdownHold() {
    if (lockdownHoldInterval) clearInterval(lockdownHoldInterval);
    lockdownHoldInterval = null;
    lockdownHoldTimer = null;
    lockdownHoldStartTime = 0;

    stopLockdownChargeSound();

    if (lockdownBtnLabel) lockdownBtnLabel.innerText = 'SECURITY SHIELD ARMED!';
    if (lockdownBtnSublabel) lockdownBtnSublabel.innerText = 'Zero Bypass Engaged';
    if (lockdownBtnIcon) lockdownBtnIcon.innerText = 'lock';

    sound.playChime('lock-heavy');
    hapticFeedback(80);

    // Launch Portal animation
    triggerLockdownPortalAnimation();

    setTimeout(() => {
      triggerLockdown();
      cancelLockdownHold();
    }, 380);
  }

  if (lockdownBtn) {
    lockdownBtn.addEventListener('mousedown', startLockdownHold);
    lockdownBtn.addEventListener('touchstart', startLockdownHold, { passive: false });
    window.addEventListener('mouseup', cancelLockdownHold);
    window.addEventListener('touchend', cancelLockdownHold);
    window.addEventListener('touchcancel', cancelLockdownHold);
  }

  function enterLockoutScreen() {
    updateThemeAtmosphere(state.selectedMode, true);

    // Trigger cinematic darken transition flash
    const flashEl = document.createElement('div');
    flashEl.className = 'lockdown-cinematic-flash pointer-events-none fixed inset-0 z-50';
    document.body.appendChild(flashEl);
    setTimeout(() => flashEl.remove(), 700);

    // Smooth view switch
    document.querySelectorAll('.screen-view').forEach(s => {
      s.classList.add('hidden');
      s.classList.remove('view-active-fade');
    });
    const lockoutView = document.getElementById('view-lockout');
    if (lockoutView) {
      lockoutView.classList.remove('hidden');
      void lockoutView.offsetWidth;
      lockoutView.classList.add('view-active-fade');
    }

    const nav = document.getElementById('app-bottom-nav');
    if (nav) nav.classList.add('hidden');

    const headerTitle = document.getElementById('header-title');
    const headerStatusDot = document.getElementById('header-status-dot');
    const headerStatusText = document.getElementById('header-status-text');

    if (headerTitle) headerTitle.innerText = 'LOCKED';
    if (headerStatusDot) {
      headerStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-error animate-ping';
    }
    if (headerStatusText) {
      headerStatusText.className = 'font-label-sm text-label-sm uppercase text-error font-bold';
      headerStatusText.innerText = 'ARMED';
    }

    const modeIndicator = document.getElementById('lock-mode-indicator');
    if (modeIndicator) {
      modeIndicator.innerText = `SESSION · ${state.selectedMode.toUpperCase()} SPRINT`;
    }

    const towerFloorBadge = document.getElementById('lock-tower-floor-text');
    if (towerFloorBadge) {
      const floorsNum = state.tower.floors ? state.tower.floors.length : 0;
      const currentHours = Math.round(((state.tower.totalFocusHours || 0) % 3.0) * 10) / 10;
      towerFloorBadge.innerText = `Floor ${floorsNum + 1} (${currentHours.toFixed(1)}/3h min)`;
    }

    renderLockSuitcaseDock();
    updateLockoutDisplay();
    updateProfileResetVisibility();
  }

  function exitLockoutToFocus() {
    state.isLocked = false;
    state.lockSecondsRemaining = 0;
    state.lockEndTime = null;
    saveState();

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // === NATIVE BLOCKING LAYER — stop enforcement ===
    if (window.AndroidBridge && typeof window.AndroidBridge.stopBlockingSession === 'function') {
      try { window.AndroidBridge.stopBlockingSession(); } catch (e) {}
    }

    const nav = document.getElementById('app-bottom-nav');
    if (nav) nav.classList.remove('hidden');

    const headerTitle = document.getElementById('header-title');
    const headerStatusDot = document.getElementById('header-status-dot');
    const headerStatusText = document.getElementById('header-status-text');

    if (headerTitle) headerTitle.innerText = 'blockWho';
    if (headerStatusDot) {
      headerStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-primary animate-pulse';
    }
    if (headerStatusText) {
      headerStatusText.className = 'font-label-sm text-label-sm uppercase text-on-surface-variant';
      headerStatusText.innerText = 'FOCUS';
    }

    updateThemeAtmosphere(state.selectedMode, false);
    updateProfileResetVisibility();
    navigateToTab('focus');
  }

  const MIN_HOURS_PER_FLOOR = 3.0;

  function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);

    // Ensure lockEndTime exists for wall-clock tracking across background state
    if (!state.lockEndTime || state.lockEndTime <= Date.now()) {
      state.lockEndTime = Date.now() + (state.lockSecondsRemaining * 1000);
      saveState();
    }

    function tick() {
      if (!state.isLocked) {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = null;
        return;
      }

      // Compute remaining seconds from wall-clock target time so background periods are counted
      const remaining = Math.max(0, Math.round((state.lockEndTime - Date.now()) / 1000));
      state.lockSecondsRemaining = remaining;

      if (remaining <= 0) {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = null;
        completeLockoutSession();
      } else {
        updateLockoutDisplay();
      }
    }

    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // ==========================================
  // ROUND DEPRECIATING COUNTDOWN DIAL CONTROLLER
  // ==========================================
  const LOCK_DIAL_RADIUS = 110;
  const LOCK_DIAL_CIRCUMFERENCE = 2 * Math.PI * LOCK_DIAL_RADIUS; // 691.15

  function initLockDialTicks() {
    const ticksGroup = document.getElementById('lock-dial-ticks');
    if (!ticksGroup || ticksGroup.children.length > 0) return;

    for (let i = 0; i < 60; i++) {
      const angle = (i * 6) * (Math.PI / 180);
      const isMajor = i % 5 === 0;
      const innerR = isMajor ? 117 : 120;
      const outerR = 124;

      const x1 = 140 + innerR * Math.cos(angle);
      const y1 = 140 + innerR * Math.sin(angle);
      const x2 = 140 + outerR * Math.cos(angle);
      const y2 = 140 + outerR * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(1));
      line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1));
      line.setAttribute('y2', y2.toFixed(1));
      line.setAttribute('stroke', 'currentColor');
      line.setAttribute('stroke-width', isMajor ? '1.5' : '1');
      ticksGroup.appendChild(line);
    }
  }

  function updateLockoutDisplay() {
    initLockDialTicks();

    const totalSecs = state.lockSecondsRemaining;
    const initialTotal = Math.max(60, state.lockTotalSeconds || 3600);
    const fraction = Math.min(1, Math.max(0, totalSecs / initialTotal));

    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const timerStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const mainTimer = document.getElementById('mainTimer');
    if (mainTimer) mainTimer.innerText = timerStr;

    // Update Round Depreciating Dial Arc
    const lockProgressArc = document.getElementById('lock-progress-arc');
    const lockDialKnob = document.getElementById('lock-dial-knob');
    const lockDialKnobCore = document.getElementById('lock-dial-knob-core');
    const lockPercentBadge = document.getElementById('lock-percent-badge');

    if (lockProgressArc) {
      const offset = LOCK_DIAL_CIRCUMFERENCE * (1 - fraction);
      lockProgressArc.style.strokeDasharray = LOCK_DIAL_CIRCUMFERENCE.toFixed(1);
      lockProgressArc.style.strokeDashoffset = offset.toFixed(1);
    }

    // Update Leading Edge Spark Knob
    if (lockDialKnob && lockDialKnobCore) {
      const angleRad = fraction * 2 * Math.PI;
      const knobX = 140 + LOCK_DIAL_RADIUS * Math.cos(angleRad);
      const knobY = 140 + LOCK_DIAL_RADIUS * Math.sin(angleRad);

      lockDialKnob.setAttribute('cx', knobX.toFixed(2));
      lockDialKnob.setAttribute('cy', knobY.toFixed(2));
      lockDialKnobCore.setAttribute('cx', knobX.toFixed(2));
      lockDialKnobCore.setAttribute('cy', knobY.toFixed(2));
    }

    if (lockPercentBadge) {
      const pct = Math.round(fraction * 100);
      lockPercentBadge.innerText = `${pct}% REMAINING`;
    }

    const targetDate = state.lockEndTime ? new Date(state.lockEndTime) : new Date(Date.now() + totalSecs * 1000);
    const timeStr = targetDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const lockRemark = document.getElementById('lock-ends-remark');
    if (lockRemark) lockRemark.innerText = `Ends strictly at ${timeStr}`;
    const stayFocusedEl = document.getElementById('lock-stay-focused-text');
    if (stayFocusedEl) stayFocusedEl.innerText = 'STAY FOCUSED';
  }

  // ==========================================
  // VICTORY LOCKOUT CELEBRATION ANIMATION
  // ==========================================
  function triggerLockoutCompleteCelebration(sessionHours, floorBuilt, floorNumber, progressHours) {
    // 1. Play victory fanfare and celebratory haptics
    sound.playChime('victory-fanfare');
    hapticFeedback(80);
    setTimeout(() => hapticFeedback(50), 180);
    setTimeout(() => hapticFeedback(100), 380);

    // 2. Launch full screen celebration modal
    const modal = document.getElementById('modal-lockout-complete');
    const statHours = document.getElementById('complete-stat-hours');
    const statStreak = document.getElementById('complete-stat-streak');
    const towerTitle = document.getElementById('complete-tower-title');
    const towerNum = document.getElementById('complete-tower-progress-num');
    const towerBar = document.getElementById('complete-tower-bar');
    const towerRemark = document.getElementById('complete-tower-remark');
    const btnDismiss = document.getElementById('btn-dismiss-complete');

    if (statHours) statHours.innerText = `+${sessionHours.toFixed(1)}h`;
    if (statStreak) statStreak.innerText = `🔥 Day ${state.tower.streakDays || 1}`;

    if (floorBuilt) {
      if (towerTitle) towerTitle.innerText = `Floor ${floorNumber} Built!`;
      if (towerNum) towerNum.innerText = `3.0 / 3.0h (100%)`;
      if (towerBar) towerBar.style.width = '100%';
      if (towerRemark) towerRemark.innerText = `🎉 Milestone achieved! Floor ${floorNumber} has been added to your skyscraper!`;
    } else {
      const pct = Math.min(100, Math.round((progressHours / MIN_HOURS_PER_FLOOR) * 100));
      const remaining = Math.max(0, Math.round((MIN_HOURS_PER_FLOOR - progressHours) * 10) / 10);
      if (towerTitle) towerTitle.innerText = `Floor ${floorNumber + 1} Construction`;
      if (towerNum) towerNum.innerText = `${progressHours.toFixed(1)} / 3.0h`;
      if (towerBar) towerBar.style.width = `${pct}%`;
      if (towerRemark) towerRemark.innerText = `${remaining.toFixed(1)}h remaining to complete this floor`;
    }

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    // Dismiss handler
    if (btnDismiss) {
      btnDismiss.onclick = () => {
        if (modal) {
          modal.classList.add('hidden');
          modal.classList.remove('flex');
        }
        exitLockoutToFocus();
        sound.playChime('click');
        hapticFeedback(20);
      };
    }
  }

  function completeLockoutSession() {
    const sessionHours = state.lockTotalSeconds / 3600;
    state.tower.totalFocusHours = Math.round(((state.tower.totalFocusHours || 0) + sessionHours) * 10) / 10;
    state.tower.streakDays = (state.tower.streakDays || 0) + 1;

    // Minimum 3 hours required to build a floor
    const earnedFloorsCount = Math.floor(state.tower.totalFocusHours / MIN_HOURS_PER_FLOOR);
    const currentFloors = state.tower.floors || [];
    const currentFloorsCount = currentFloors.length;
    const progressHoursInCurrentFloor = Math.round((state.tower.totalFocusHours % MIN_HOURS_PER_FLOOR) * 10) / 10;
    const todayStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    let floorBuilt = false;
    let newFloorNumber = currentFloorsCount;

    if (earnedFloorsCount > currentFloorsCount) {
      floorBuilt = true;
      const floorsToAdd = earnedFloorsCount - currentFloorsCount;
      for (let i = 0; i < floorsToAdd; i++) {
        const newFloorNum = currentFloorsCount + i + 1;
        currentFloors.push({
          floor: newFloorNum,
          mode: state.selectedMode === 'study' ? 'Study Sprint' : state.selectedMode === 'sleep' ? 'Sleep Sanctuary' : 'Deep Work',
          duration: Math.round(MIN_HOURS_PER_FLOOR * 60),
          date: todayStr,
          parachutes: 0
        });
      }
      state.tower.floors = currentFloors;
      state.tower.floorsCount = currentFloors.length;
      newFloorNumber = currentFloors.length;
    } else {
      state.tower.floorsCount = currentFloorsCount;
    }

    saveState();
    renderTowerTab();

    // Trigger cool celebration sequence & modal
    triggerLockoutCompleteCelebration(sessionHours, floorBuilt, newFloorNumber, progressHoursInCurrentFloor);
  }

  // ==========================================
  // 5. EXTEND LOCKOUT (+15M HOLD MECHANIC)
  // ==========================================
  const addTimeBtn = document.getElementById('addTimeBtn');
  const addTimeProgress = document.getElementById('addTimeProgress');
  const addTimeLabel = document.getElementById('addTimeLabel');
  let extendTimer = null;

  function startExtend(e) {
    e.preventDefault();
    if (!state.isLocked) return;
    if (addTimeProgress) {
      addTimeProgress.style.transition = 'width 3000ms linear';
      addTimeProgress.style.width = '100%';
    }

    extendTimer = setTimeout(() => {
      state.lockSecondsRemaining += 15 * 60;
      state.lockTotalSeconds += 15 * 60;
      state.lockEndTime = Date.now() + (state.lockSecondsRemaining * 1000);
      saveState();
      if (window.AndroidBridge && typeof window.AndroidBridge.startBlockingSession === 'function') {
        try {
          const allowedPkgs = state.suitcaseApps.filter(a => a.packed && a.pkg).map(a => a.pkg);
          window.AndroidBridge.startBlockingSession(state.lockSecondsRemaining, JSON.stringify(allowedPkgs), state.parachutesCount);
        } catch (e) {}
      }

      if (addTimeProgress) {
        addTimeProgress.style.transition = 'none';
        addTimeProgress.style.width = '0%';
      }
      sound.playChime('success');
      hapticFeedback(40);
      if (addTimeLabel) {
        const originalText = addTimeLabel.innerText;
        addTimeLabel.innerText = "+15M EXTENDED!";
        setTimeout(() => { addTimeLabel.innerText = originalText; }, 1800);
      }
    }, 3000);
  }

  function cancelExtend() {
    if (extendTimer) {
      clearTimeout(extendTimer);
      extendTimer = null;
      if (addTimeProgress) {
        addTimeProgress.style.transition = 'width 150ms ease-out';
        addTimeProgress.style.width = '0%';
      }
    }
  }

  if (addTimeBtn) {
    addTimeBtn.addEventListener('mousedown', startExtend);
    addTimeBtn.addEventListener('touchstart', startExtend, { passive: false });
    window.addEventListener('mouseup', cancelExtend);
    window.addEventListener('touchend', cancelExtend);
  }

  // ==========================================
  // 6. EMERGENCY EJECT (HOLD 3S)
  // ==========================================
  const chuteBtn = document.getElementById('parachuteBtn');
  const chuteProgress = document.getElementById('parachuteProgress');
  const chuteLabel = document.getElementById('parachuteLabel');
  const chuteIcon = document.getElementById('parachuteIcon');
  const streakWarning = document.getElementById('streakWarning');
  let chuteTimer = null;

  function startChuteHold(e) {
    e.preventDefault();
    if (!state.isLocked) return;

    // === ZERO EMERGENCY EJECTS = NO EXIT (BlockIt strict mode) ===
    if (state.parachutesCount <= 0) {
      hapticFeedback(30);
      if (chuteLabel) {
        const orig = chuteLabel.innerText;
        chuteLabel.innerText = '✕ No Emergency Ejects Left';
        setTimeout(() => { chuteLabel.innerText = orig; }, 1800);
      }
      sound.playChime('alert');
      return;
    }

    if (chuteProgress) {
      chuteProgress.style.transition = 'width 3000ms linear';
      chuteProgress.style.width = '100%';
    }

    setTimeout(() => {
      if (chuteTimer && chuteLabel && chuteIcon) {
        chuteLabel.classList.remove('text-primary');
        chuteLabel.classList.add('text-on-primary');
        chuteIcon.classList.remove('text-primary');
        chuteIcon.classList.add('text-on-primary');
      }
    }, 1200);

    chuteTimer = setTimeout(() => {
      // Completed full 3-second hold!
      sound.playChime('alert');
      hapticFeedback(80);
      if (chuteLabel) chuteLabel.innerText = "EMERGENCY EJECT ACTIVATED";
      if (streakWarning) {
        streakWarning.innerText = "Session unlocked via emergency eject";
        streakWarning.classList.add('text-error');
      }
      
      // Decrement emergency eject
      if (state.parachutesCount > 0) {
        state.parachutesCount--;
      }
      saveState();
      updateParachuteCounters();

      setTimeout(() => {
        exitLockoutToFocus();
        cancelChuteHold();
      }, 1000);
    }, 3000);
  }

  function cancelChuteHold() {
    if (chuteTimer) {
      clearTimeout(chuteTimer);
      chuteTimer = null;
      if (chuteProgress) {
        chuteProgress.style.transition = 'width 200ms ease-out';
        chuteProgress.style.width = '0%';
      }
      if (chuteLabel) {
        chuteLabel.innerText = "Hold 3s to Emergency Eject";
        chuteLabel.classList.remove('text-on-primary');
        chuteLabel.classList.add('text-primary');
      }
      if (chuteIcon) {
        chuteIcon.classList.remove('text-on-primary');
        chuteIcon.classList.add('text-primary');
      }
    }
  }

  if (chuteBtn) {
    chuteBtn.addEventListener('mousedown', startChuteHold);
    chuteBtn.addEventListener('touchstart', startChuteHold, { passive: false });
    window.addEventListener('mouseup', cancelChuteHold);
    window.addEventListener('touchend', cancelChuteHold);
  }

  function updateParachuteCounters() {
    const topCount = document.getElementById('top-parachute-count');
    const cardLeft = document.getElementById('card-parachute-left');
    const lockBadge = document.getElementById('lock-eject-badge');

    if (topCount) topCount.innerText = state.parachutesCount;
    if (cardLeft) cardLeft.innerText = `${state.parachutesCount} left`;
    if (lockBadge) lockBadge.innerText = `${state.parachutesCount} Left This Cycle`;
  }


    // ==========================================
  // 8. SUITCASE MANAGEMENT & MINI-APPS
  // ==========================================

  // Synchronize current whitelisted packages to Android native layer in real-time
  function syncNativeAllowedPackages() {
    if (window.AndroidBridge && typeof window.AndroidBridge.updateAllowedPackages === 'function') {
      try {
        const allowed = state.suitcaseApps
          .filter(a => a.packed && a.pkg)
          .map(a => a.pkg);
        window.AndroidBridge.updateAllowedPackages(JSON.stringify(allowed));
      } catch (e) {
        console.warn('syncNativeAllowedPackages failed:', e);
      }
    }
  }

  // Pre-load / cache installed apps from device into catalog for the "+ Add App" modal
  function loadInstalledAppsCatalog() {
    if (window.AndroidBridge && typeof window.AndroidBridge.getInstalledApps === 'function') {
      try {
        const raw = window.AndroidBridge.getInstalledApps();
        const apps = JSON.parse(raw);
        if (Array.isArray(apps) && apps.length > 0) {
          state._installedAppsCatalog = apps;
          return;
        }
      } catch (e) {
        console.warn('getInstalledApps error:', e);
      }
    }
    // Fallback catalog for web / desktop testing
    if (!state._installedAppsCatalog || state._installedAppsCatalog.length === 0) {
      state._installedAppsCatalog = [
        { pkg: 'com.whatsapp', name: 'WhatsApp' },
        { pkg: 'com.google.android.youtube', name: 'YouTube' },
        { pkg: 'com.instagram.android', name: 'Instagram' },
        { pkg: 'com.android.chrome', name: 'Google Chrome' },
        { pkg: 'com.spotify.music', name: 'Spotify' },
        { pkg: 'notion.id', name: 'Notion' },
        { pkg: 'com.slack', name: 'Slack' },
        { pkg: 'com.amazon.kindle', name: 'Amazon Kindle' },
        { pkg: 'com.google.android.keep', name: 'Google Keep' },
        { pkg: 'com.duolingo', name: 'Duolingo' },
        { pkg: 'org.telegram.messenger', name: 'Telegram' },
        { pkg: 'com.twitter.android', name: 'X / Twitter' },
        { pkg: 'com.google.android.gm', name: 'Gmail' },
        { pkg: 'com.google.android.apps.docs', name: 'Google Docs' },
        { pkg: 'com.microsoft.todos', name: 'Microsoft To Do' },
        { pkg: 'com.ticktick.task', name: 'TickTick' }
      ];
    }
  }

  // "+ Add App" Modal Handlers
  function openAddAppModal() {
    loadInstalledAppsCatalog();
    const modal = document.getElementById('modal-add-suitcase-app');
    const searchInput = document.getElementById('input-search-installed-apps');
    if (searchInput) searchInput.value = '';
    renderInstalledAppsPicker('');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    sound.playChime('click');
    hapticFeedback(15);
  }

  function closeAddAppModal() {
    const modal = document.getElementById('modal-add-suitcase-app');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    renderSuitcaseTab();
    renderLockSuitcaseDock();
    updateTimerInterface();
  }

  function renderInstalledAppsPicker(filterText) {
    const list = document.getElementById('installed-apps-picker-list');
    const countEl = document.getElementById('suitcase-modal-selected-count');
    if (!list) return;
    list.innerHTML = '';

    const query = (filterText || '').toLowerCase().trim();
    const catalog = state._installedAppsCatalog || [];
    const filtered = query
      ? catalog.filter(a => a.name.toLowerCase().includes(query) || a.pkg.toLowerCase().includes(query))
      : catalog;

    const existingPkgs = new Set(state.suitcaseApps.filter(a => a.pkg).map(a => a.pkg));
    const builtinIds = new Set(['audio']);
    const customCount = state.suitcaseApps.filter(a => !builtinIds.has(a.id)).length;
    if (countEl) countEl.innerText = customCount;

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="p-6 text-center text-outline font-body-sm text-xs">
          No matching apps found.
        </div>
      `;
      return;
    }

    filtered.forEach(app => {
      const isAdded = existingPkgs.has(app.pkg);
      const row = document.createElement('div');
      row.className = 'p-2.5 rounded-lg bg-surface-container flex items-center justify-between border border-white/5 hover:border-white/15 transition-all';

      const firstChar = (app.name && app.name.length > 0) ? app.name.charAt(0).toUpperCase() : 'A';

      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="w-8 h-8 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
            ${firstChar}
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-label-sm text-white font-semibold truncate text-xs">${app.name}</div>
            <div class="font-mono text-[9px] text-outline/60 truncate">${app.pkg}</div>
          </div>
        </div>
        <button class="btn-toggle-add-app px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer flex-shrink-0 ml-2 ${
          isAdded
            ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-error/20 hover:text-error hover:border-error/30'
            : 'bg-surface-container-high text-white hover:bg-primary hover:text-black'
        }">
          <span class="material-symbols-outlined text-[14px]">${isAdded ? 'check' : 'add'}</span>
          <span>${isAdded ? 'Added' : 'Add'}</span>
        </button>
      `;

      const btn = row.querySelector('.btn-toggle-add-app');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isAdded) {
          // Remove from suitcase
          state.suitcaseApps = state.suitcaseApps.filter(a => a.pkg !== app.pkg);
        } else {
          // Add to suitcase
          state.suitcaseApps.push({
            id: app.pkg,
            pkg: app.pkg,
            name: app.name,
            icon: 'apps',
            desc: app.pkg,
            packed: true,
            isCustom: true
          });
        }
        saveState();
        syncNativeAllowedPackages();
        updateSuitcaseCounters();
        renderInstalledAppsPicker(query);
        sound.playChime('click');
        hapticFeedback(15);
      });

      list.appendChild(row);
    });
  }

  // Hook up Add App Modal Buttons & Search Input
  const btnOpenAddAppModal = document.getElementById('btn-open-add-app-modal');
  if (btnOpenAddAppModal) {
    btnOpenAddAppModal.addEventListener('click', openAddAppModal);
  }
  const btnCloseAddAppModal = document.getElementById('btn-close-add-app-modal');
  if (btnCloseAddAppModal) {
    btnCloseAddAppModal.addEventListener('click', closeAddAppModal);
  }
  const btnDoneAddAppModal = document.getElementById('btn-done-add-app-modal');
  if (btnDoneAddAppModal) {
    btnDoneAddAppModal.addEventListener('click', closeAddAppModal);
  }
  const searchInputApps = document.getElementById('input-search-installed-apps');
  if (searchInputApps) {
    searchInputApps.addEventListener('input', (e) => {
      renderInstalledAppsPicker(e.target.value);
    });
  }

  function updateSuitcaseCounters() {
    const customPacked = state.suitcaseApps.filter(a => a.packed && a.id !== 'audio');
    const packedCount = customPacked.length;
    const totalApps = state.suitcaseApps.filter(a => a.id !== 'audio').length;
    const counterEl = document.getElementById('suitcase-active-counter');
    const fractionEl = document.getElementById('focus-suitcase-fraction');
    const badgeEl = document.getElementById('lock-suitcase-allowed-badge');

    if (counterEl) counterEl.innerText = packedCount;
    if (fractionEl) fractionEl.innerText = `${packedCount}/${totalApps}`;
    // Lockdown mode badge includes 1 permanent default app (Focus Soundscape) + custom apps
    if (badgeEl) badgeEl.innerText = `${packedCount + 1} Allowed`;
  }

  function renderSuitcaseTab() {
    const container = document.getElementById('suitcase-apps-list');
    if (!container) return;
    container.innerHTML = '';

    updateSuitcaseCounters();

    // Update Strict Mode button display
    const labelStrict = document.getElementById('label-strict-mode');
    const btnStrict = document.getElementById('btn-toggle-strict-mode');
    if (labelStrict && btnStrict) {
      if (state.strictMode !== false) {
        labelStrict.innerText = 'STRICT';
        btnStrict.className = 'px-3 py-1 rounded-full bg-primary/10 hover:bg-primary/20 active:scale-95 text-primary font-label-sm text-xs font-semibold border border-primary/20 transition-all cursor-pointer';
      } else {
        labelStrict.innerText = 'STANDARD';
        btnStrict.className = 'px-3 py-1 rounded-full bg-surface-container hover:bg-surface-variant active:scale-95 text-outline font-label-sm text-xs font-semibold border border-white/10 transition-all cursor-pointer';
      }
    }

    const customApps = state.suitcaseApps.filter(a => a.id !== 'audio');

    // Section: Whitelisted Apps (Focus Soundscape is default in lockdown and not manageable here)
    const secHeader = document.createElement('div');
    secHeader.className = 'pt-2 pb-1 flex items-center justify-between text-xs font-semibold text-outline uppercase tracking-wider';
    secHeader.innerHTML = `
      <span>Whitelisted Apps (${customApps.length})</span>
      <button class="text-primary hover:underline text-[11px] font-bold flex items-center gap-0.5 cursor-pointer btn-sub-add-app">
        <span class="material-symbols-outlined text-[13px]">add</span> Add More
      </button>
    `;
    const subAddBtn = secHeader.querySelector('.btn-sub-add-app');
    if (subAddBtn) subAddBtn.addEventListener('click', openAddAppModal);
    container.appendChild(secHeader);

    if (customApps.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'p-6 rounded-xl border border-dashed border-white/10 bg-surface-container-lowest text-center space-y-2.5';
      emptyCard.innerHTML = `
        <div class="w-11 h-11 rounded-full bg-surface-container-high text-primary flex items-center justify-center mx-auto">
          <span class="material-symbols-outlined text-[22px]">add_to_home_screen</span>
        </div>
        <div class="font-label-md text-primary font-bold text-xs">No Custom Apps Whitelisted</div>
        <p class="font-body-sm text-[11px] text-outline max-w-[260px] mx-auto">Focus Soundscape is permanently active by default during lockdown. Tap "+ Add App" to whitelist any specific apps from your device.</p>
        <button class="btn-empty-add-app px-4 py-2 rounded-full bg-primary text-black font-label-sm text-xs font-bold hover:brightness-110 active:scale-95 transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer mt-1">
          <span class="material-symbols-outlined text-[15px]">add</span>
          <span>Add App to Whitelist</span>
        </button>
      `;
      emptyCard.querySelector('.btn-empty-add-app').addEventListener('click', openAddAppModal);
      container.appendChild(emptyCard);
    } else {
      customApps.forEach(app => {
        container.appendChild(createSuitcaseAppCard(app, true));
      });
    }
  }

  function createSuitcaseAppCard(app, isCustom) {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-lg bg-surface-container-low flex items-center justify-between border border-white/5 hover:border-white/15 transition-all';

    const subtitle = app.pkg && isCustom
      ? `<span class="font-mono text-[9px] text-outline/60 truncate max-w-[150px] block">${app.pkg}</span>`
      : `<span class="font-body-sm text-xs text-outline truncate block max-w-[170px]">${app.desc || ''}</span>`;

    const iconHtml = getAppIconHtml(app, 'w-10 h-10', 'text-[20px]');

    const deleteBtnHtml = isCustom
      ? `<button class="btn-remove-custom-app w-8 h-8 rounded-full bg-surface-container-high hover:bg-error/20 hover:text-error text-outline flex items-center justify-center active:scale-95 transition-all cursor-pointer" title="Remove ${app.name} from Suitcase" data-id="${app.id}">
           <span class="material-symbols-outlined text-[15px]">delete</span>
         </button>`
      : '';

    card.innerHTML = `
      <div class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer app-info-area">
        <div class="flex-shrink-0">
          ${iconHtml}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-label-md text-primary font-bold truncate">${app.name}</div>
          ${subtitle}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0 ml-2">
        <button class="btn-test-app w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-variant text-primary flex items-center justify-center active:scale-95 transition-all cursor-pointer" title="Preview / Test ${app.name}" data-id="${app.id}">
          <span class="material-symbols-outlined text-[16px]">visibility</span>
        </button>
        ${deleteBtnHtml}
        <label class="cyber-toggle" title="${app.packed ? 'Packed (Whitelisted)' : 'Unpacked (Intercepted)'}">
          <input type="checkbox" data-id="${app.id}" ${app.packed ? 'checked' : ''} class="suitcase-toggle">
          <span class="cyber-toggle-track">
            <span class="cyber-toggle-thumb"></span>
          </span>
        </label>
      </div>
    `;

    const input = card.querySelector('input');
    const testBtn = card.querySelector('.btn-test-app');
    const infoArea = card.querySelector('.app-info-area');
    const removeBtn = card.querySelector('.btn-remove-custom-app');

    // 1. Toggle switch handler
    input.addEventListener('change', (e) => {
      app.packed = e.target.checked;
      saveState();
      syncNativeAllowedPackages();
      updateSuitcaseCounters();
      updateTimerInterface();
      renderLockSuitcaseDock();
      sound.playChime('click');
      hapticFeedback(15);
    });

    // 2. Info area click: toggles checkbox
    if (infoArea) {
      infoArea.addEventListener('click', () => {
        input.checked = !input.checked;
        app.packed = input.checked;
        saveState();
        syncNativeAllowedPackages();
        updateSuitcaseCounters();
        updateTimerInterface();
        renderLockSuitcaseDock();
        sound.playChime('click');
        hapticFeedback(15);
      });
    }

    // 3. Test / Preview button handler
    if (testBtn) {
      testBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMiniApp(app.id);
      });
    }

    // 4. Remove custom app handler
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.suitcaseApps = state.suitcaseApps.filter(a => a.id !== app.id);
        saveState();
        syncNativeAllowedPackages();
        updateSuitcaseCounters();
        renderSuitcaseTab();
        renderLockSuitcaseDock();
        updateTimerInterface();
        sound.playChime('click');
        hapticFeedback(20);
      });
    }

    return card;
  }

  // Pack All button
  const btnPackAll = document.getElementById('btn-pack-all-suitcase');
  if (btnPackAll) {
    btnPackAll.addEventListener('click', () => {
      state.suitcaseApps.forEach(a => a.packed = true);
      saveState();
      syncNativeAllowedPackages();
      renderSuitcaseTab();
      updateTimerInterface();
      renderLockSuitcaseDock();
      sound.playChime('success');
      hapticFeedback(30);
    });
  }

  // Unpack All button
  const btnUnpackAll = document.getElementById('btn-unpack-all-suitcase');
  if (btnUnpackAll) {
    btnUnpackAll.addEventListener('click', () => {
      state.suitcaseApps.forEach(a => a.packed = false);
      saveState();
      syncNativeAllowedPackages();
      renderSuitcaseTab();
      updateTimerInterface();
      renderLockSuitcaseDock();
      sound.playChime('click');
      hapticFeedback(20);
    });
  }

  // Toggle Strict Mode button
  const btnToggleStrict = document.getElementById('btn-toggle-strict-mode');
  if (btnToggleStrict) {
    btnToggleStrict.addEventListener('click', () => {
      state.strictMode = !(state.strictMode !== false);
      saveState();
      if (window.AndroidBridge && typeof window.AndroidBridge.setStrictMode === 'function') {
        window.AndroidBridge.setStrictMode(state.strictMode);
      }
      renderSuitcaseTab();
      sound.playChime('click');
      hapticFeedback(20);
    });
  }

  // Native Blocker callback when an unauthorized app is intercepted
  window.onNativeAppBlocked = function(pkg) {
    try {
      sound.playChime('shield');
      hapticFeedback(80);
      const shieldModal = document.getElementById('modal-shield');
      const shieldAppName = document.getElementById('shield-app-name');
      if (shieldModal && shieldAppName) {
        const found = state._installedAppsCatalog?.find(a => a.pkg === pkg);
        shieldAppName.innerText = found ? found.name : (pkg || 'Unauthorized Application');
        shieldModal.classList.remove('hidden');
        shieldModal.classList.add('flex');
      }
    } catch (e) {
      console.warn('onNativeAppBlocked error:', e);
    }
  };

  const BUILTIN_APP_STYLES = {
    audio: {
      bg: 'linear-gradient(135deg, #181920 0%, #0d0e12 100%)',
      icon: 'music_note',
      iconColor: '#00E5FF',
      border: '1px solid rgba(0, 229, 255, 0.28)'
    }
  };

  const KNOWN_APP_STYLES = {
    'com.whatsapp': { bg: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', icon: 'chat', iconColor: '#FFF' },
    'com.google.android.youtube': { bg: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)', icon: 'smart_display', iconColor: '#FFF' },
    'com.spotify.music': { bg: 'linear-gradient(135deg, #1DB954 0%, #191414 100%)', icon: 'music_note', iconColor: '#FFF' },
    'com.instagram.android': { bg: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)', icon: 'photo_camera', iconColor: '#FFF' },
    'com.android.chrome': { bg: 'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC05 100%)', icon: 'public', iconColor: '#FFF' },
    'com.google.android.gm': { bg: 'linear-gradient(135deg, #EA4335 0%, #B31412 100%)', icon: 'mail', iconColor: '#FFF' },
    'com.slack': { bg: 'linear-gradient(135deg, #4A154B 0%, #611f69 100%)', icon: 'tag', iconColor: '#FFF' },
    'org.telegram.messenger': { bg: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)', icon: 'send', iconColor: '#FFF' },
    'com.google.android.keep': { bg: 'linear-gradient(135deg, #FBBC04 0%, #F29900 100%)', icon: 'lightbulb', iconColor: '#121212' },
    'com.amazon.kindle': { bg: 'linear-gradient(135deg, #00A8E1 0%, #007EB9 100%)', icon: 'auto_stories', iconColor: '#FFF' },
    'notion.id': { bg: 'linear-gradient(135deg, #2A2A2E 0%, #191919 100%)', icon: 'description', iconColor: '#FFF' }
  };

  function getAppIconHtml(app, sizeCls = 'w-11 h-11', iconSizeCls = 'text-[22px]') {
    // If running on Android, fetch and cache the real application icon
    if (!app.iconDataUrl && app.pkg && window.AndroidBridge && typeof window.AndroidBridge.getAppIconBase64 === 'function') {
      try {
        const base64Uri = window.AndroidBridge.getAppIconBase64(app.pkg);
        if (base64Uri && base64Uri.startsWith('data:image')) {
          app.iconDataUrl = base64Uri;
        }
      } catch (e) {}
    }

    if (app.iconDataUrl) {
      return `
        <div class="${sizeCls} rounded-2xl bg-surface-container-highest p-1 flex items-center justify-center shadow-md border border-white/10 overflow-hidden flex-shrink-0">
          <img src="${app.iconDataUrl}" class="w-full h-full object-contain rounded-xl" alt="${app.name || 'App'}" />
        </div>
      `;
    }

    const style = BUILTIN_APP_STYLES[app.id] || (app.pkg ? KNOWN_APP_STYLES[app.pkg] : null);
    if (style) {
      const borderAttr = style.border ? `border: ${style.border};` : 'border: 1px solid rgba(255,255,255,0.1);';
      return `
        <div class="${sizeCls} rounded-2xl flex items-center justify-center shadow-md flex-shrink-0" style="background: ${style.bg}; ${borderAttr}">
          <span class="material-symbols-outlined ${iconSizeCls}" style="color: ${style.iconColor};">${style.icon}</span>
        </div>
      `;
    }

    // Generic fallback with initials or material symbol
    return `
      <div class="${sizeCls} rounded-2xl bg-gradient-to-br from-surface-container-high to-surface-container-highest flex items-center justify-center text-primary shadow-md border border-white/10 flex-shrink-0">
        <span class="material-symbols-outlined ${iconSizeCls}">${app.icon || 'apps'}</span>
      </div>
    `;
  }

  function renderLockSuitcaseDock() {
    const dockContainer = document.getElementById('dock-allowed-apps');
    const badge = document.getElementById('lock-suitcase-allowed-badge');

    // Focus Soundscape is an immutable, built-in default app during lockdown mode
    const defaultApps = [
      { id: 'audio', name: 'Focus Soundscape', icon: 'music_note', isDefault: true }
    ];
    const userPacked = state.suitcaseApps.filter(a => a.packed && a.id !== 'audio');
    const allAllowed = [...defaultApps, ...userPacked];

    if (badge) badge.innerText = `${allAllowed.length} Allowed`;

    if (dockContainer) {
      dockContainer.innerHTML = '';
      dockContainer.className = 'flex flex-col gap-1.5 w-full';

      allAllowed.forEach(app => {
        const row = document.createElement('button');
        row.className = 'w-full py-2.5 px-3.5 rounded-xl bg-surface-container-high/70 hover:bg-surface-container-highest border border-white/5 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer group shadow-sm';
        const fullName = app.name || app.pkg || 'Application';

        const defaultTag = app.isDefault
          ? `<span class="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-label-sm font-semibold tracking-wider uppercase shrink-0">Default</span>`
          : '';

        row.innerHTML = `
          <div class="flex items-center gap-2.5 truncate pr-2">
            <span class="w-1.5 h-1.5 rounded-full ${app.isDefault ? 'bg-cyan-400' : 'bg-primary/40 group-hover:bg-primary'} transition-colors shrink-0"></span>
            <span class="font-label-md text-xs font-semibold text-primary/90 tracking-wide truncate">${fullName}</span>
            ${defaultTag}
          </div>
          <div class="flex items-center gap-1 text-[11px] font-label-sm text-outline group-hover:text-primary transition-colors shrink-0">
            <span>Open</span>
            <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
          </div>
        `;

        row.addEventListener('click', () => {
          sound.playChime('click');
          hapticFeedback(15);
          openMiniApp(app.id);
        });

        dockContainer.appendChild(row);
      });
    }
  }


  // Mini-App Modal Controller
  window.openMiniApp = function(appId) {
    // If it's a real Android package name, try launching via native bridge
    if (window.AndroidBridge && typeof window.AndroidBridge.launchApp === 'function') {
      const foundApp = state.suitcaseApps.find(a => a.id === appId || a.pkg === appId);
      if (foundApp && foundApp.pkg && foundApp.id !== 'audio') {
        try {
          const launched = window.AndroidBridge.launchApp(foundApp.pkg);
          if (launched) return;
        } catch (e) {
          console.warn('Native launch failed:', e);
        }
      }
    }

    const modal = document.getElementById('modal-mini-app');
    const titleEl = document.getElementById('mini-app-title');
    const iconEl = document.getElementById('mini-app-icon');
    const contentEl = document.getElementById('mini-app-content');
    if (!modal || !contentEl) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    sound.playChime('click');
    hapticFeedback(20);

    const targetApp = state.suitcaseApps.find(a => a.id === appId || a.pkg === appId);
    const builtinIds = new Set(['audio']);

    if (targetApp && !builtinIds.has(targetApp.id)) {
      // User Custom App Preview Card
      if (titleEl) titleEl.innerText = targetApp.name || 'Application Preview';
      if (iconEl) iconEl.innerText = 'preview';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-4">
          <div class="hover:scale-105 transition-transform">
            ${getAppIconHtml(targetApp, 'w-20 h-20', 'text-[36px]')}
          </div>
          <div>
            <h3 class="font-headline-md text-base text-primary font-bold">${targetApp.name}</h3>
            <p class="font-mono text-xs text-outline mt-0.5">${targetApp.pkg || 'Whitelisted Tool'}</p>
          </div>
          <div class="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-label-sm font-semibold flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[15px]">verified</span>
            <span>Packed in Suitcase · Distraction Free</span>
          </div>
          <button class="w-full max-w-[220px] py-2.5 rounded-full bg-primary text-black font-label-md text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer btn-launch-custom-app">
            <span class="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>Launch App</span>
          </button>
        </div>
      `;
      const launchBtn = contentEl.querySelector('.btn-launch-custom-app');
      if (launchBtn) {
        launchBtn.addEventListener('click', () => {
          if (window.AndroidBridge && typeof window.AndroidBridge.launchApp === 'function' && targetApp.pkg) {
            window.AndroidBridge.launchApp(targetApp.pkg);
          } else {
            alert(`Launching ${targetApp.name} (${targetApp.pkg || 'app'}). Permitted in lockdown.`);
          }
        });
      }
      return;
    }

    if (appId === 'calc') {
      // Functional Calculator
      if (titleEl) titleEl.innerText = 'Calculator';
      if (iconEl) iconEl.innerText = 'calculate';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col space-y-3">
          <!-- Calculator Screen Display -->
          <div class="w-full rounded-xl bg-surface-container-lowest border border-white/10 p-3 flex flex-col justify-end text-right">
            <div class="font-mono text-xs text-outline tracking-wider h-5 overflow-hidden" id="calc-history"></div>
            <div class="font-mono text-2xl font-bold text-white tracking-tight h-8 overflow-hidden select-all" id="calc-display">0</div>
          </div>
          <!-- Calculator Keypad (4x5 Grid) -->
          <div class="grid grid-cols-4 gap-1.5">
            <button class="calc-key h-11 rounded-lg bg-surface-container-high hover:bg-surface-variant active:scale-95 text-sm font-mono font-bold text-error transition-all" data-action="clear">C</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container-high hover:bg-surface-variant active:scale-95 text-sm font-mono font-bold text-white transition-all" data-action="negate">±</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container-high hover:bg-surface-variant active:scale-95 text-sm font-mono font-bold text-white transition-all" data-action="percent">%</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container-highest hover:bg-white hover:text-black active:scale-95 text-base font-mono font-bold text-primary transition-all" data-action="op" data-val="/">÷</button>

            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="7">7</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="8">8</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="9">9</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container-highest hover:bg-white hover:text-black active:scale-95 text-base font-mono font-bold text-primary transition-all" data-action="op" data-val="*">×</button>

            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="4">4</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="5">5</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="6">6</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container-highest hover:bg-white hover:text-black active:scale-95 text-base font-mono font-bold text-primary transition-all" data-action="op" data-val="-">-</button>

            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="1">1</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="2">2</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="num" data-val="3">3</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container-highest hover:bg-white hover:text-black active:scale-95 text-base font-mono font-bold text-primary transition-all" data-action="op" data-val="+">+</button>

            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white col-span-2 transition-all" data-action="num" data-val="0">0</button>
            <button class="calc-key h-11 rounded-lg bg-surface-container hover:bg-surface-variant active:scale-95 text-base font-mono font-bold text-white transition-all" data-action="dot">.</button>
            <button class="calc-key h-11 rounded-lg bg-primary text-black font-bold hover:bg-white active:scale-95 text-base font-mono transition-all" data-action="equals">=</button>
          </div>
        </div>
      `;

      let currentInput = '0';
      let previousInput = '';
      let currentOp = null;
      let shouldResetDisplay = false;

      function updateCalcUI() {
        const display = document.getElementById('calc-display');
        const history = document.getElementById('calc-history');
        if (display) display.innerText = currentInput;
        if (history) {
          history.innerText = previousInput + (currentOp ? ' ' + currentOp : '');
        }
      }

      function compute() {
        const prev = parseFloat(previousInput);
        const curr = parseFloat(currentInput);
        if (isNaN(prev) || isNaN(curr)) return;
        let res = 0;
        if (currentOp === '+') res = prev + curr;
        else if (currentOp === '-') res = prev - curr;
        else if (currentOp === '*') res = prev * curr;
        else if (currentOp === '/') res = curr === 0 ? 'Error' : prev / curr;
        currentInput = typeof res === 'number' ? String(Math.round(res * 100000000) / 100000000) : res;
      }

      document.querySelectorAll('.calc-key').forEach(btn => {
        btn.addEventListener('click', () => {
          sound.playChime('click');
          hapticFeedback(15);
          const action = btn.getAttribute('data-action');
          const val = btn.getAttribute('data-val');

          if (action === 'num') {
            if (currentInput === '0' || shouldResetDisplay) {
              currentInput = val;
              shouldResetDisplay = false;
            } else {
              if (currentInput.length < 12) currentInput += val;
            }
          } else if (action === 'dot') {
            if (shouldResetDisplay) {
              currentInput = '0.';
              shouldResetDisplay = false;
            } else if (!currentInput.includes('.')) {
              currentInput += '.';
            }
          } else if (action === 'clear') {
            currentInput = '0';
            previousInput = '';
            currentOp = null;
            shouldResetDisplay = false;
          } else if (action === 'negate') {
            if (currentInput !== '0') {
              currentInput = currentInput.startsWith('-') ? currentInput.slice(1) : '-' + currentInput;
            }
          } else if (action === 'percent') {
            const num = parseFloat(currentInput);
            if (!isNaN(num)) currentInput = String(num / 100);
          } else if (action === 'op') {
            if (currentOp && !shouldResetDisplay) {
              compute();
            }
            previousInput = currentInput;
            currentOp = val;
            shouldResetDisplay = true;
          } else if (action === 'equals') {
            if (currentOp && previousInput) {
              compute();
              currentOp = null;
              previousInput = '';
              shouldResetDisplay = true;
            }
          }
          updateCalcUI();
        });
      });

    } else if (appId === 'maps') {
      if (titleEl) titleEl.innerText = 'Google Maps & Transit';
      if (iconEl) iconEl.innerText = 'navigation';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col space-y-3">
          <div class="relative w-full h-40 rounded-xl bg-surface-container-lowest overflow-hidden border border-white/10 flex items-center justify-center">
            <svg class="w-full h-full opacity-40" viewBox="0 0 300 160">
              <path d="M10,80 Q90,20 150,70 T290,90" fill="none" stroke="#555" stroke-width="6" />
              <path d="M40,150 L120,10 L220,150" fill="none" stroke="#444" stroke-width="4" />
              <path d="M10,80 Q90,20 150,70 T290,90" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="6 4" />
              <circle cx="150" cy="70" r="7" fill="#ffffff" />
              <circle cx="150" cy="70" r="16" fill="none" stroke="#ffffff" stroke-width="1.5" class="animate-ping" />
            </svg>
            <div class="absolute bottom-2 left-2 px-2.5 py-1 rounded-full bg-surface-container/90 text-[10px] font-label-sm text-primary flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              GPS ACTIVE · TRANSIT ROUTE
            </div>
          </div>
          <div class="p-3 rounded-lg bg-surface-container text-xs space-y-1">
            <div class="font-bold text-white flex items-center justify-between">
              <span>Main Library ➔ Tech Innovation Hall</span>
              <span class="text-primary font-mono">12 min walk</span>
            </div>
            <p class="text-outline text-[11px]">Walk 400m North along West Campus Arcade, proceed to Hall 4.</p>
          </div>
        </div>
      `;
    } else if (appId === 'audio') {
      if (titleEl) titleEl.innerText = 'Focus Soundscape Synthesizer';
      if (iconEl) iconEl.innerText = 'music_note';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col space-y-4">
          <div class="grid grid-cols-2 gap-2" id="soundscape-types">
            <button class="sound-chip p-2.5 rounded-lg bg-white text-black font-label-sm text-xs font-semibold text-center transition-all cursor-pointer" data-type="binaural">
              40Hz Gamma Beat
            </button>
            <button class="sound-chip p-2.5 rounded-lg bg-surface-container text-outline hover:text-white font-label-sm text-xs font-semibold text-center transition-all cursor-pointer" data-type="brown">
              Cabin Brown Noise
            </button>
            <button class="sound-chip p-2.5 rounded-lg bg-surface-container text-outline hover:text-white font-label-sm text-xs font-semibold text-center transition-all cursor-pointer" data-type="rain">
              Gentle Rain
            </button>
            <button class="sound-chip p-2.5 rounded-lg bg-surface-container text-outline hover:text-white font-label-sm text-xs font-semibold text-center transition-all cursor-pointer" data-type="white">
              Pure White Noise
            </button>
          </div>
          <div>
            <div class="flex justify-between text-xs text-outline font-label-sm mb-1">
              <span>MASTER VOLUME</span>
              <span id="vol-display">50%</span>
            </div>
            <input type="range" min="0" max="100" value="50" id="sound-vol-slider" class="w-full accent-white h-1.5 bg-surface-container-highest rounded-lg cursor-pointer">
          </div>
          <button id="btn-toggle-soundscape" class="w-full py-3 rounded-full bg-primary text-on-primary font-label-md text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer">
            <span class="material-symbols-outlined text-[18px]">play_arrow</span>
            <span id="soundscape-btn-label">Start Soundscape</span>
          </button>
        </div>
      `;

      // Wire soundscape buttons
      const toggleBtn = document.getElementById('btn-toggle-soundscape');
      const label = document.getElementById('soundscape-btn-label');
      const chips = document.querySelectorAll('.sound-chip');
      const slider = document.getElementById('sound-vol-slider');
      const volDisplay = document.getElementById('vol-display');

      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => {
            c.className = 'sound-chip p-2.5 rounded-lg bg-surface-container text-outline hover:text-white font-label-sm text-xs font-semibold text-center transition-all cursor-pointer';
          });
          chip.className = 'sound-chip p-2.5 rounded-lg bg-white text-black font-label-sm text-xs font-semibold text-center transition-all cursor-pointer';
          const type = chip.getAttribute('data-type');
          sound.playChime('click');
          hapticFeedback(15);
          if (sound.isPlaying) {
            sound.startSoundscape(type);
          } else {
            sound.currentSound = type;
          }
        });
      });

      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = e.target.value;
          if (volDisplay) volDisplay.innerText = `${val}%`;
          sound.setVolume(val / 100);
        });
      }

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          sound.init();
          hapticFeedback(25);
          if (sound.isPlaying) {
            sound.stopSoundscape();
            if (label) label.innerText = 'Start Soundscape';
            toggleBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">play_arrow</span><span>Start Soundscape</span>`;
          } else {
            sound.startSoundscape();
            toggleBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">stop</span><span>Stop Soundscape</span>`;
          }
        });
      }

    } else if (appId === 'phone') {
      if (titleEl) titleEl.innerText = 'Emergency Calls';
      if (iconEl) iconEl.innerText = 'call';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col space-y-3">
          <div class="w-full h-12 rounded-xl bg-surface-container-lowest border border-white/10 px-4 flex items-center justify-end">
            <span class="font-mono text-xl text-primary font-bold tracking-widest" id="dial-screen"></span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            ${['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => `
              <button class="keypad-digit h-12 rounded-xl bg-surface-container hover:bg-surface-variant active:scale-95 text-lg font-mono font-bold text-white transition-all cursor-pointer" data-key="${d}">
                ${d}
              </button>
            `).join('')}
          </div>
          <div class="flex gap-2 pt-1">
            <button class="flex-1 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-label-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer" id="btn-dispatch-call">
              <span class="material-symbols-outlined text-[18px]">call</span>
              <span>Dispatch Call</span>
            </button>
            <button class="w-12 h-12 rounded-full bg-surface-container-high hover:bg-surface-variant text-white flex items-center justify-center font-bold active:scale-95 cursor-pointer" id="btn-dial-backspace">
              ⌫
            </button>
          </div>
        </div>
      `;

      const screen = document.getElementById('dial-screen');
      document.querySelectorAll('.keypad-digit').forEach(btn => {
        btn.addEventListener('click', () => {
          const k = btn.getAttribute('data-key');
          sound.playDTMF(k);
          hapticFeedback(15);
          if (screen) screen.innerText = (screen.innerText + k).slice(0, 14);
        });
      });

      const bsp = document.getElementById('btn-dial-backspace');
      if (bsp) {
        bsp.addEventListener('click', () => {
          hapticFeedback(15);
          if (screen) screen.innerText = screen.innerText.slice(0, -1);
        });
      }

      const dispatchCall = document.getElementById('btn-dispatch-call');
      if (dispatchCall) {
        dispatchCall.addEventListener('click', () => {
          hapticFeedback(30);
          const num = screen.innerText || '911';
          window.location.href = `tel:${num}`;
        });
      }

    } else if (appId === 'reader') {
      // Document Reader
      if (titleEl) titleEl.innerText = 'Document Reader';
      if (iconEl) iconEl.innerText = 'menu_book';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col space-y-3">
          <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container text-xs">
            <span class="text-outline font-label-sm">FOCUS_PRINCIPLES.PDF · PAGE 1/3</span>
            <div class="flex items-center gap-1.5">
              <button id="btn-reader-zoom-out" class="w-7 h-7 rounded bg-surface-container-high hover:bg-surface-variant text-white flex items-center justify-center font-bold text-xs cursor-pointer">A-</button>
              <button id="btn-reader-zoom-in" class="w-7 h-7 rounded bg-surface-container-high hover:bg-surface-variant text-white flex items-center justify-center font-bold text-xs cursor-pointer">A+</button>
            </div>
          </div>
          <div id="reader-document-body" class="w-full flex-1 min-h-[220px] max-h-[280px] rounded-xl bg-surface-container-lowest border border-white/10 p-4 text-xs font-serif text-white/90 leading-relaxed overflow-y-auto no-scrollbar space-y-3 select-text">
            <h4 class="font-sans font-bold text-sm text-primary">Core Principles of Unbroken Focus</h4>
            <p>1. <strong>Attention Residue:</strong> Every switch between tasks leaves a cognitive penalty that degrades working memory. When in lockdown, honor the boundary completely.</p>
            <p>2. <strong>Boredom as Fuel:</strong> The urge to check notifications is the brain craving easy dopamine. Sitting through boredom without escape triggers peak neuroplasticity and creative breakthrough.</p>
            <p>3. <strong>The Deep Work Hypothesis:</strong> The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable in our economy.</p>
          </div>
        </div>
      `;

      let currentFontSize = 12;
      const docBody = document.getElementById('reader-document-body');
      const btnZoomOut = document.getElementById('btn-reader-zoom-out');
      const btnZoomIn = document.getElementById('btn-reader-zoom-in');
      if (btnZoomOut && docBody) {
        btnZoomOut.addEventListener('click', () => {
          currentFontSize = Math.max(10, currentFontSize - 1);
          docBody.style.fontSize = `${currentFontSize}px`;
          sound.playChime('click');
          hapticFeedback(10);
        });
      }
      if (btnZoomIn && docBody) {
        btnZoomIn.addEventListener('click', () => {
          currentFontSize = Math.min(18, currentFontSize + 1);
          docBody.style.fontSize = `${currentFontSize}px`;
          sound.playChime('click');
          hapticFeedback(10);
        });
      }

    } else if (appId === 'camera') {
      // Document Scanner
      if (titleEl) titleEl.innerText = 'Document Scanner';
      if (iconEl) iconEl.innerText = 'photo_camera';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col space-y-3">
          <div class="relative w-full h-48 rounded-xl bg-surface-container-lowest overflow-hidden border border-white/10 flex flex-col items-center justify-center text-center p-3">
            <div class="absolute inset-4 border border-white/30 rounded-lg pointer-events-none flex flex-col justify-between p-2">
              <div class="flex justify-between">
                <span class="w-3 h-3 border-t-2 border-l-2 border-white"></span>
                <span class="w-3 h-3 border-t-2 border-r-2 border-white"></span>
              </div>
              <div class="flex justify-between">
                <span class="w-3 h-3 border-b-2 border-l-2 border-white"></span>
                <span class="w-3 h-3 border-b-2 border-r-2 border-white"></span>
              </div>
            </div>
            <div id="scanner-viewfinder-status" class="text-xs text-outline font-label-sm">
              <span class="material-symbols-outlined text-[32px] text-primary/60 mb-1">document_scanner</span>
              <div>Position document within the border</div>
              <div class="text-[10px] text-outline/60 mt-0.5">High-contrast monochrome capture</div>
            </div>
          </div>
          <div class="flex items-center justify-between px-2 pt-1">
            <button id="btn-scanner-flash" class="w-10 h-10 rounded-full bg-surface-container-high hover:bg-surface-variant text-white flex items-center justify-center cursor-pointer transition-all" title="Toggle Flash">
              <span class="material-symbols-outlined text-[18px]">flash_off</span>
            </button>
            <button id="btn-scanner-shutter" class="w-14 h-14 rounded-full bg-white hover:bg-white/90 active:scale-95 text-black flex items-center justify-center font-bold shadow-lg cursor-pointer transition-all" title="Capture Scan">
              <div class="w-11 h-11 rounded-full border-2 border-black flex items-center justify-center">
                <span class="w-9 h-9 rounded-full bg-black/10"></span>
              </div>
            </button>
            <button id="btn-scanner-retake" class="w-10 h-10 rounded-full bg-surface-container-high hover:bg-surface-variant text-white flex items-center justify-center cursor-pointer transition-all" title="Retake">
              <span class="material-symbols-outlined text-[18px]">restart_alt</span>
            </button>
          </div>
        </div>
      `;

      const shutter = document.getElementById('btn-scanner-shutter');
      const flashBtn = document.getElementById('btn-scanner-flash');
      const retakeBtn = document.getElementById('btn-scanner-retake');
      const statusText = document.getElementById('scanner-viewfinder-status');
      let flashOn = false;

      if (flashBtn) {
        flashBtn.addEventListener('click', () => {
          flashOn = !flashOn;
          flashBtn.innerHTML = flashOn 
            ? '<span class="material-symbols-outlined text-[18px] text-amber-400">flash_on</span>'
            : '<span class="material-symbols-outlined text-[18px]">flash_off</span>';
          sound.playChime('click');
          hapticFeedback(15);
        });
      }

      if (shutter && statusText) {
        shutter.addEventListener('click', () => {
          sound.playChime('success');
          hapticFeedback(40);
          statusText.innerHTML = `
            <span class="material-symbols-outlined text-[32px] text-emerald-400 mb-1">check_circle</span>
            <div class="text-white font-bold">Document Captured & Cached</div>
            <div class="text-[10px] text-outline mt-0.5">Stored in local offline memory</div>
          `;
        });
      }

      if (retakeBtn && statusText) {
        retakeBtn.addEventListener('click', () => {
          sound.playChime('click');
          hapticFeedback(15);
          statusText.innerHTML = `
            <span class="material-symbols-outlined text-[32px] text-primary/60 mb-1">document_scanner</span>
            <div>Position document within the border</div>
            <div class="text-[10px] text-outline/60 mt-0.5">High-contrast monochrome capture</div>
          `;
        });
      }

    } else if (appId === 'scratchpad') {
      // Quick Scratchpad
      if (titleEl) titleEl.innerText = 'Quick Scratchpad';
      if (iconEl) iconEl.innerText = 'edit_note';
      contentEl.innerHTML = `
        <div class="flex-1 flex flex-col space-y-2">
          <textarea id="scratch-textarea" class="w-full h-44 rounded-xl bg-surface-container-lowest border border-white/10 p-3 text-sm text-white font-mono outline-none resize-none focus:border-white/30" placeholder="Type thoughts here...">${state.scratchpadContent}</textarea>
          <div class="flex justify-between items-center text-[11px] font-label-sm text-outline">
            <span id="scratch-char-count">${state.scratchpadContent.length} chars</span>
            <div class="flex items-center gap-2">
              <button id="btn-copy-scratch" class="px-2.5 py-1 rounded-md bg-surface-container hover:bg-surface-variant text-white flex items-center gap-1 text-[11px] cursor-pointer">
                <span class="material-symbols-outlined text-[13px]">content_copy</span>
                <span id="copy-scratch-label">Copy</span>
              </button>
              <button id="btn-clear-scratch" class="px-2.5 py-1 rounded-md bg-surface-container hover:bg-surface-variant text-error flex items-center gap-1 text-[11px] cursor-pointer">
                <span class="material-symbols-outlined text-[13px]">delete</span>
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      `;

      const ta = document.getElementById('scratch-textarea');
      const charCount = document.getElementById('scratch-char-count');
      if (ta) {
        ta.addEventListener('input', (e) => {
          state.scratchpadContent = e.target.value;
          if (charCount) charCount.innerText = `${state.scratchpadContent.length} chars`;
          saveState();
        });
      }

      const copyBtn = document.getElementById('btn-copy-scratch');
      const copyLabel = document.getElementById('copy-scratch-label');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(state.scratchpadContent || '');
          sound.playChime('click');
          hapticFeedback(20);
          if (copyLabel) {
            copyLabel.innerText = 'Copied!';
            setTimeout(() => { copyLabel.innerText = 'Copy'; }, 1500);
          }
        });
      }

      const clearBtn = document.getElementById('btn-clear-scratch');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (confirm('Clear scratchpad content?')) {
            state.scratchpadContent = '';
            if (ta) ta.value = '';
            if (charCount) charCount.innerText = '0 chars';
            saveState();
            sound.playChime('click');
            hapticFeedback(20);
          }
        });
      }
    }
  };

  const btnCloseMiniApp = document.getElementById('btn-close-mini-app');
  if (btnCloseMiniApp) {
    btnCloseMiniApp.addEventListener('click', () => {
      const modal = document.getElementById('modal-mini-app');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
      sound.playChime('click');
      hapticFeedback(15);
    });
  }

  // ==========================================
  // 9. THE TOWER TAB (HABIT SKYSCRAPER)
  // ==========================================
  function renderTowerTab() {
    const stack = document.getElementById('tower-floors-stack');
    if (!stack) return;
    stack.innerHTML = '';

    const streakEl = document.getElementById('tower-streak-number');
    const floorsEl = document.getElementById('tower-floors-total');
    const hoursEl = document.getElementById('tower-hours-total');
    const tierLabel = document.getElementById('tower-tier-label');
    const tierDesc = document.getElementById('tower-tier-desc');

    const totalFloors = state.tower.floors ? state.tower.floors.length : 0;
    state.tower.floorsCount = totalFloors;
    if (streakEl) streakEl.innerText = state.tower.streakDays || 0;
    if (floorsEl) floorsEl.innerText = totalFloors;
    if (hoursEl) hoursEl.innerText = `${state.tower.totalFocusHours || 0}h`;

    // Dynamic Tier calculation
    if (tierLabel && tierDesc) {
      if (totalFloors === 0) {
        tierLabel.innerText = 'Tier 0';
        tierDesc.innerText = 'Ground';
      } else if (totalFloors < 5) {
        tierLabel.innerText = 'Tier I';
        tierDesc.innerText = 'Cottage';
      } else if (totalFloors < 10) {
        tierLabel.innerText = 'Tier II';
        tierDesc.innerText = 'Townhouse';
      } else {
        tierLabel.innerText = 'Tier III';
        tierDesc.innerText = 'Skyscraper';
      }
    }

    // Floor Construction Progress Card (Minimum 3 Hours to Build a Floor)
    const totalHours = state.tower.totalFocusHours || 0;
    const currentProgressHours = Math.round((totalHours % 3.0) * 10) / 10;
    const nextFloorNum = totalFloors + 1;
    const progressPercent = Math.min(100, Math.round((currentProgressHours / 3.0) * 100));
    const hoursRemaining = Math.max(0, Math.round((3.0 - currentProgressHours) * 10) / 10);

    const titleEl = document.getElementById('tower-progress-floor-title');
    const hoursProgressEl = document.getElementById('tower-progress-hours');
    const barEl = document.getElementById('tower-progress-bar');
    const remainingEl = document.getElementById('tower-progress-remaining');

    if (titleEl) titleEl.innerText = `Floor ${nextFloorNum} Construction`;
    if (hoursProgressEl) hoursProgressEl.innerText = `${currentProgressHours.toFixed(1)} / 3.0h (Min 3h)`;
    if (barEl) barEl.style.width = `${progressPercent}%`;
    if (remainingEl) remainingEl.innerText = `${hoursRemaining.toFixed(1)}h remaining`;

    // Also update Profile modal stats
    const profStreak = document.getElementById('profile-streak-val');
    const profHours = document.getElementById('profile-hours-val');
    if (profStreak) profStreak.innerText = `${state.tower.streakDays || 0} Days`;
    if (profHours) profHours.innerText = `${state.tower.totalFocusHours || 0}h`;

    // Render floor slabs (stacked from floor 1 to N)
    if (!state.tower.floors || state.tower.floors.length === 0) {
      const nameEl = document.getElementById('inspect-floor-name');
      const detailsEl = document.getElementById('inspect-floor-details');
      if (nameEl) nameEl.innerText = 'No Floors Built Yet';
      if (detailsEl) detailsEl.innerText = 'Complete at least 3 hours of focus to start constructing your tower (Minimum 3 hours per floor).';

      const emptyCard = document.createElement('div');
      emptyCard.className = 'w-full py-8 px-4 rounded-xl border border-dashed border-white/10 bg-surface-container-low/50 flex flex-col items-center justify-center text-center space-y-2';
      emptyCard.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline">
          <span class="material-symbols-outlined text-[20px]">apartment</span>
        </div>
        <div>
          <div class="font-label-md text-xs font-semibold text-primary">Tower Awaiting Construction</div>
          <div class="font-body-sm text-[11px] text-outline mt-0.5">Complete at least 3 hours of focus to construct Floor 1 (Minimum 3 hours per floor).</div>
        </div>
      `;
      stack.appendChild(emptyCard);
      return;
    }

    state.tower.floors.forEach((f, idx) => {
      const slab = document.createElement('div');
      const isTop = idx === state.tower.floors.length - 1;
      slab.className = `w-full h-8 rounded-md flex items-center justify-between px-3 text-xs font-mono transition-all cursor-pointer ${
        isTop ? 'bg-primary text-black font-bold shadow-md' : 'bg-surface-container-high hover:bg-surface-variant text-white border border-white/5'
      }`;
      slab.innerHTML = `
        <span class="flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[14px]">${isTop ? 'star' : 'apartment'}</span>
          <span>FL ${f.floor}</span>
        </span>
        <span class="text-[10px] ${isTop ? 'text-black/80' : 'text-outline'}">${f.duration}m · ${f.mode.split(' ')[0]}</span>
      `;

      slab.addEventListener('click', () => {
        inspectFloor(f);
        sound.playChime('click');
        hapticFeedback(15);
      });

      stack.appendChild(slab);
    });

    inspectFloor(state.tower.floors[state.tower.floors.length - 1]);
  }

  function inspectFloor(f) {
    const nameEl = document.getElementById('inspect-floor-name');
    const detailsEl = document.getElementById('inspect-floor-details');
    if (!f) return;
    if (nameEl) nameEl.innerText = `Floor ${f.floor}: ${f.mode}`;
    const durStr = f.duration >= 60 ? `${(f.duration / 60).toFixed(1)} Hours` : `${f.duration} Minutes`;
    if (detailsEl) detailsEl.innerText = `Constructed ${f.date} · ${durStr} (Min 3h requirement met) · ${f.parachutes} Emergency Ejects Used`;
  }

  // ==========================================
  // 10. SCHEDULED ROUTINES TAB
  // ==========================================
  function renderRoutinesTab() {
    const container = document.getElementById('routines-container');
    if (!container) return;
    container.innerHTML = '';

    state.routines.forEach(r => {
      const card = document.createElement('div');
      card.className = 'p-3.5 rounded-lg bg-surface-container-low flex items-center justify-between border border-white/5';
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[20px]">alarm</span>
          </div>
          <div>
            <div class="font-label-md text-primary font-bold">${r.name}</div>
            <div class="font-body-sm text-xs text-outline mt-0.5 flex items-center gap-2">
              <span class="text-white font-mono">${r.time}</span>
              <span>·</span>
              <span>${r.duration}m lock</span>
              <span>·</span>
              <span class="text-[10px] text-primary/80">${r.days.join(', ')}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-delete-routine w-8 h-8 rounded-full bg-surface-container-high hover:bg-error/20 hover:text-error text-outline flex items-center justify-center transition-colors cursor-pointer" data-id="${r.id}" title="Delete routine">
            <span class="material-symbols-outlined text-[16px]">delete</span>
          </button>
          <label class="cyber-toggle" title="${r.active ? 'Scheduled Active' : 'Disabled'}">
            <input type="checkbox" data-id="${r.id}" ${r.active ? 'checked' : ''}>
            <span class="cyber-toggle-track">
              <span class="cyber-toggle-thumb"></span>
            </span>
          </label>
        </div>
      `;

      const input = card.querySelector('input');
      input.addEventListener('change', (e) => {
        r.active = e.target.checked;
        saveState();
        sound.playChime('click');
        hapticFeedback(15);
      });

      const delBtn = card.querySelector('.btn-delete-routine');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.routines = state.routines.filter(item => item.id !== r.id);
          saveState();
          renderRoutinesTab();
          sound.playChime('click');
          hapticFeedback(20);
        });
      }

      container.appendChild(card);
    });
  }

  // Routine Modal
  const btnAddRoutineModal = document.getElementById('btn-add-routine-modal');
  const modalRoutine = document.getElementById('modal-routine');
  const btnCloseRoutineModal = document.getElementById('btn-close-routine-modal');
  const formRoutine = document.getElementById('form-routine');

  if (btnAddRoutineModal) {
    btnAddRoutineModal.addEventListener('click', () => {
      if (modalRoutine) {
        modalRoutine.classList.remove('hidden');
        modalRoutine.classList.add('flex');
        sound.playChime('click');
        hapticFeedback(15);
      }
    });
  }

  if (btnCloseRoutineModal) {
    btnCloseRoutineModal.addEventListener('click', () => {
      if (modalRoutine) {
        modalRoutine.classList.add('hidden');
        modalRoutine.classList.remove('flex');
      }
    });
  }

  // Day chip toggles in routine modal
  document.querySelectorAll('.day-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      chip.classList.toggle('bg-white');
      chip.classList.toggle('text-black');
      chip.classList.toggle('text-white');
      chip.classList.toggle('bg-surface-container-high');
      sound.playChime('click');
      hapticFeedback(10);
    });
  });

  if (formRoutine) {
    formRoutine.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('routine-input-name').value;
      const time = document.getElementById('routine-input-time').value;
      const duration = parseInt(document.getElementById('routine-input-duration').value, 10);
      
      const activeDays = [];
      document.querySelectorAll('.day-chip.active').forEach(c => {
        activeDays.push(c.getAttribute('data-day'));
      });

      state.routines.push({
        id: 'r_' + Date.now(),
        name: name || 'Focus Cycle',
        time: time || '09:00',
        duration: duration || 60,
        days: activeDays.length > 0 ? activeDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        active: true
      });

      saveState();
      renderRoutinesTab();

      if (modalRoutine) {
        modalRoutine.classList.add('hidden');
        modalRoutine.classList.remove('flex');
      }
      formRoutine.reset();
      sound.playChime('success');
      hapticFeedback(30);
    });
  }

  // ==========================================
  // 11. TAB NAVIGATION & VIEW SWITCHER
  // ==========================================
  function navigateToTab(tabId) {
    state.activeTab = tabId;
    saveState();

    // If currently locked and user clicks focus, show lockout screen
    if (tabId === 'focus' && state.isLocked) {
      enterLockoutScreen();
      updateNavHighlight('focus');
      return;
    }

    // Smoothly transition screens
    document.querySelectorAll('.screen-view').forEach(s => {
      s.classList.add('hidden');
      s.classList.remove('view-active-fade');
    });

    const targetScreen = document.getElementById(`view-${tabId}`);
    if (targetScreen) {
      targetScreen.classList.remove('hidden');
      void targetScreen.offsetWidth; // Force reflow for entrance animation
      targetScreen.classList.add('view-active-fade');
    }

    updateNavHighlight(tabId);
    updateThemeAtmosphere(state.selectedMode, state.isLocked);

    // Tab-specific renders
    if (tabId === 'focus') {
      updateTimerInterface();
    } else if (tabId === 'suitcase') {
      renderSuitcaseTab();
    } else if (tabId === 'tower') {
      renderTowerTab();
    } else if (tabId === 'routines') {
      renderRoutinesTab();
    }
  }

  function updateNavHighlight(tabId) {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (tab === tabId) {
        btn.classList.add('text-primary', 'bg-surface-container-highest');
        btn.classList.remove('text-on-surface-variant');
      } else {
        btn.classList.remove('text-primary', 'bg-surface-container-highest');
        btn.classList.add('text-on-surface-variant');
      }
    });
  }

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = btn.getAttribute('data-tab');
      navigateToTab(tab);
      sound.playChime('tab-switch');
      hapticFeedback(12);
    });
  });

  // Shield Intercept Alert Dismissal
  const modalShield = document.getElementById('modal-shield');
  const btnDismissShield = document.getElementById('btn-dismiss-shield');
  if (btnDismissShield && modalShield) {
    btnDismissShield.addEventListener('click', () => {
      modalShield.classList.add('hidden');
      modalShield.classList.remove('flex');
      sound.playChime('click');
      hapticFeedback(15);
    });
  }

  // ==========================================
  // 12. PERMISSIONS SETUP & FIRST-RUN ONBOARDING
  // ==========================================
  function showPermissionsModal() {
    const modal = document.getElementById('modal-permissions');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      window.refreshPermissionBadges();
      sound.playChime('click');
      hapticFeedback(20);
    }
  }

  function checkAndShowPermissionsOnboarding() {
    const configured = localStorage.getItem('blockwho_permissions_configured');
    if (!configured) {
      // First-time app open: trigger permissions onboarding modal
      setTimeout(showPermissionsModal, 400);
    }
    // On Android: load real installed apps into suitcase
    if (window.AndroidBridge) {
      setTimeout(loadInstalledAppsCatalog, 800);
      syncNativeAllowedPackages();
    }
    // On Android: check if we need to restore a session that was running
    // when the app was closed or minimized
    syncSessionFromBackground();
  }

  function syncSessionFromBackground() {
    if (!state.isLocked) {
      if (window.AndroidBridge && typeof window.AndroidBridge.isBlockingSessionActive === 'function') {
        try {
          if (window.AndroidBridge.isBlockingSessionActive()) {
            const remaining = window.AndroidBridge.getSessionRemainingSeconds();
            if (remaining > 0) {
              state.isLocked = true;
              state.lockSecondsRemaining = remaining;
              state.lockTotalSeconds = Math.max(state.lockTotalSeconds || 0, remaining);
              state.lockEndTime = Date.now() + (remaining * 1000);
              saveState();
              enterLockoutScreen();
              startCountdownTimer();
              return;
            }
          }
        } catch (e) {
          console.warn('Session restore check failed:', e);
        }
      }
      return;
    }

    // Lockdown active — re-sync time when returning to foreground
    if (window.AndroidBridge && typeof window.AndroidBridge.getSessionRemainingSeconds === 'function') {
      try {
        if (window.AndroidBridge.isBlockingSessionActive()) {
          const remaining = window.AndroidBridge.getSessionRemainingSeconds();
          if (remaining > 0) {
            state.lockSecondsRemaining = remaining;
            state.lockEndTime = Date.now() + (remaining * 1000);
            updateLockoutDisplay();
            saveState();
          } else {
            completeLockoutSession();
            return;
          }
        } else {
          completeLockoutSession();
          return;
        }
      } catch (e) {}
    } else if (state.lockEndTime) {
      const remaining = Math.max(0, Math.round((state.lockEndTime - Date.now()) / 1000));
      state.lockSecondsRemaining = remaining;
      if (remaining <= 0) {
        completeLockoutSession();
        return;
      }
      updateLockoutDisplay();
      saveState();
    }
  }

  window.syncSessionFromNative = syncSessionFromBackground;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncSessionFromBackground();
  });
  window.addEventListener('focus', syncSessionFromBackground);
  window.addEventListener('pageshow', syncSessionFromBackground);

  window.refreshPermissionBadges = function() {
    const isAndroid = !!window.AndroidBridge;
    const grantedCls = 'px-2 py-0.5 rounded-full text-[10px] font-label-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    const requiredCls = 'px-2 py-0.5 rounded-full text-[10px] font-label-sm font-bold bg-error-container/30 text-error border border-error/30';
    const optionalCls = 'px-2 py-0.5 rounded-full text-[10px] font-label-sm font-bold bg-surface-container-high text-outline';

    // 1. Accessibility Service — MOST CRITICAL (actual app blocking)
    const accessGranted = isAndroid && typeof window.AndroidBridge.hasAccessibilityPermission === 'function'
      ? window.AndroidBridge.hasAccessibilityPermission() : false;
    const badgeAccess = document.getElementById('badge-perm-access');
    const labelAccess = document.getElementById('label-grant-access');
    if (badgeAccess) {
      badgeAccess.className = accessGranted ? grantedCls : requiredCls;
      badgeAccess.innerText = accessGranted ? '✓ Enabled' : 'Required';
    }
    if (labelAccess) {
      labelAccess.innerText = accessGranted ? 'App Blocking Active' : 'Enable App Blocking';
    }
    // Also update the inline header accessibility status dot
    window.refreshAccessibilityStatus && window.refreshAccessibilityStatus();

    // 2. Usage stats
    const usageGranted = isAndroid && typeof window.AndroidBridge.hasUsageStatsPermission === 'function'
      ? window.AndroidBridge.hasUsageStatsPermission() : false;
    const badgeUsage = document.getElementById('badge-perm-usage');
    const labelUsage = document.getElementById('label-grant-usage');
    if (badgeUsage) {
      badgeUsage.className = usageGranted ? grantedCls : requiredCls;
      badgeUsage.innerText = usageGranted ? '✓ Granted' : 'Required';
    }
    if (labelUsage) {
      labelUsage.innerText = usageGranted ? 'Usage Access Active' : 'Grant Usage Access';
    }

    // 3. Overlay
    const overlayGranted = isAndroid && typeof window.AndroidBridge.hasOverlayPermission === 'function'
      ? window.AndroidBridge.hasOverlayPermission() : false;
    const badgeOverlay = document.getElementById('badge-perm-overlay');
    const labelOverlay = document.getElementById('label-grant-overlay');
    if (badgeOverlay) {
      badgeOverlay.className = overlayGranted ? grantedCls : requiredCls;
      badgeOverlay.innerText = overlayGranted ? '✓ Granted' : 'Required';
    }
    if (labelOverlay) {
      labelOverlay.innerText = overlayGranted ? 'Overlay Access Active' : 'Grant Overlay Access';
    }

    // 4. Notifications
    const notifGranted = isAndroid && typeof window.AndroidBridge.hasNotificationPermission === 'function'
      ? window.AndroidBridge.hasNotificationPermission() : false;
    const badgeNotif = document.getElementById('badge-perm-notif');
    const labelNotif = document.getElementById('label-grant-notif');
    if (badgeNotif) {
      badgeNotif.className = notifGranted ? grantedCls : optionalCls;
      badgeNotif.innerText = notifGranted ? '✓ Granted' : 'Recommended';
    }
    if (labelNotif) {
      labelNotif.innerText = notifGranted ? 'Notifications Active' : 'Allow Notifications';
    }
  };

  // Live status in header
  window.refreshAccessibilityStatus = function() {
    const headerStatusDot = document.getElementById('header-status-dot');
    const headerStatusText = document.getElementById('header-status-text');
    if (headerStatusDot && headerStatusText && !state.isLocked) {
      headerStatusDot.className = 'w-1.5 h-1.5 rounded-full bg-primary animate-pulse';
      headerStatusText.innerText = 'FOCUS';
    }
  };

  const btnGrantAccess = document.getElementById('btn-grant-access');
  if (btnGrantAccess) {
    btnGrantAccess.addEventListener('click', () => {
      sound.playChime('click');
      hapticFeedback(20);
      if (window.AndroidBridge && typeof window.AndroidBridge.requestAccessibilityPermission === 'function') {
        window.AndroidBridge.requestAccessibilityPermission();
      } else {
        alert('Accessibility permission is required on Android to enable app blocking. Go to Settings > Accessibility > blockWho > Enable.');
      }
    });
  }

  const btnGrantUsage = document.getElementById('btn-grant-usage');
  if (btnGrantUsage) {
    btnGrantUsage.addEventListener('click', () => {
      sound.playChime('click');
      hapticFeedback(20);
      if (window.AndroidBridge && typeof window.AndroidBridge.requestUsageStatsPermission === 'function') {
        window.AndroidBridge.requestUsageStatsPermission();
      } else {
        alert('Usage stats permission opens system settings on Android devices.');
      }
    });
  }

  const btnGrantOverlay = document.getElementById('btn-grant-overlay');
  if (btnGrantOverlay) {
    btnGrantOverlay.addEventListener('click', () => {
      sound.playChime('click');
      hapticFeedback(20);
      if (window.AndroidBridge && typeof window.AndroidBridge.requestOverlayPermission === 'function') {
        window.AndroidBridge.requestOverlayPermission();
      } else {
        alert('Overlay permission opens system settings on Android devices.');
      }
    });
  }

  const btnGrantNotif = document.getElementById('btn-grant-notif');
  if (btnGrantNotif) {
    btnGrantNotif.addEventListener('click', () => {
      sound.playChime('click');
      hapticFeedback(20);
      if (window.AndroidBridge && typeof window.AndroidBridge.requestNotificationPermission === 'function') {
        window.AndroidBridge.requestNotificationPermission();
      } else if ('Notification' in window) {
        Notification.requestPermission().then(() => window.refreshPermissionBadges());
      }
    });
  }

  const btnCompletePermissions = document.getElementById('btn-complete-permissions');
  const btnClosePermissionsModal = document.getElementById('btn-close-permissions-modal');

  function dismissPermissionsModal() {
    localStorage.setItem('blockwho_permissions_configured', 'true');
    const modal = document.getElementById('modal-permissions');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    sound.playChime('success');
    hapticFeedback(30);
  }

  if (btnCompletePermissions) btnCompletePermissions.addEventListener('click', dismissPermissionsModal);
  if (btnClosePermissionsModal) btnClosePermissionsModal.addEventListener('click', dismissPermissionsModal);

  // ==========================================
  // 13. PROFILE & SYSTEM SETTINGS MODAL
  // ==========================================
  function updateProfileResetVisibility() {
    const btnReset = document.getElementById('btn-reset-app-data');
    const msgLocked = document.getElementById('profile-reset-locked-msg');
    if (state && state.isLocked) {
      if (btnReset) btnReset.classList.add('hidden');
      if (msgLocked) {
        msgLocked.classList.remove('hidden');
        msgLocked.classList.add('flex');
      }
    } else {
      if (btnReset) btnReset.classList.remove('hidden');
      if (msgLocked) {
        msgLocked.classList.add('hidden');
        msgLocked.classList.remove('flex');
      }
    }
  }

  const btnHeaderProfile = document.getElementById('btn-header-profile');
  const modalProfile = document.getElementById('modal-profile');
  const btnCloseProfile = document.getElementById('btn-close-profile-modal');

  if (btnHeaderProfile && modalProfile) {
    btnHeaderProfile.addEventListener('click', () => {
      const streakVal = document.getElementById('profile-streak-val');
      const hoursVal = document.getElementById('profile-hours-val');
      const chuteVal = document.getElementById('profile-parachute-count');

      if (streakVal) streakVal.innerText = `${state.tower.streakDays} Days`;
      if (hoursVal) hoursVal.innerText = `${state.tower.totalFocusHours}h`;
      if (chuteVal) chuteVal.innerText = `${state.parachutesCount} remaining`;

      updateProfileResetVisibility();

      modalProfile.classList.remove('hidden');
      modalProfile.classList.add('flex');
      sound.playChime('click');
      hapticFeedback(20);
    });
  }

  if (btnCloseProfile && modalProfile) {
    btnCloseProfile.addEventListener('click', () => {
      modalProfile.classList.add('hidden');
      modalProfile.classList.remove('flex');
      sound.playChime('click');
      hapticFeedback(15);
    });
  }

  const toggleHaptics = document.getElementById('toggle-haptics');
  if (toggleHaptics) {
    toggleHaptics.checked = state.hapticsEnabled !== false;
    toggleHaptics.addEventListener('change', (e) => {
      state.hapticsEnabled = e.target.checked;
      saveState();
      hapticFeedback(30);
    });
  }

  const toggleAudio = document.getElementById('toggle-audio-effects');
  if (toggleAudio) {
    toggleAudio.checked = state.audioEnabled !== false;
    toggleAudio.addEventListener('change', (e) => {
      state.audioEnabled = e.target.checked;
      saveState();
      sound.playChime('click');
    });
  }

  const btnOpenPermManager = document.getElementById('btn-open-perm-manager');
  if (btnOpenPermManager) {
    btnOpenPermManager.addEventListener('click', () => {
      if (modalProfile) {
        modalProfile.classList.add('hidden');
        modalProfile.classList.remove('flex');
      }
      showPermissionsModal();
    });
  }

  const btnResetAppData = document.getElementById('btn-reset-app-data');
  if (btnResetAppData) {
    btnResetAppData.addEventListener('click', () => {
      if (state && state.isLocked) {
        alert('Resetting app data and streak is strictly prohibited during active lockdown mode.');
        return;
      }
      if (confirm('Are you sure you want to reset all streak progress, routines, and app data? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
      }
    });
  }

  // ==========================================
  // 14. EMERGENCY EJECT INFO DIALOG
  // ==========================================
  const btnHeaderParachute = document.getElementById('btn-header-parachute');
  const modalParachuteInfo = document.getElementById('modal-parachute-info');
  const btnCloseParachuteInfo = document.getElementById('btn-close-parachute-info');
  const btnDismissParachuteInfo = document.getElementById('btn-dismiss-parachute-info');

  if (btnHeaderParachute) {
    btnHeaderParachute.addEventListener('click', () => {
      if (state.isLocked) {
        // If locked, scroll smoothly to the emergency eject long-press button
        const chuteBtnEl = document.getElementById('parachuteBtn');
        if (chuteBtnEl) {
          chuteBtnEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          chuteBtnEl.classList.add('ring-2', 'ring-white/50');
          setTimeout(() => chuteBtnEl.classList.remove('ring-2', 'ring-white/50'), 1500);
        }
      } else {
        if (modalParachuteInfo) {
          const statusEl = document.getElementById('parachute-info-status');
          if (statusEl) statusEl.innerText = `${state.parachutesCount} Available`;
          modalParachuteInfo.classList.remove('hidden');
          modalParachuteInfo.classList.add('flex');
        }
      }
      sound.playChime('click');
      hapticFeedback(20);
    });
  }

  function dismissParachuteInfo() {
    if (modalParachuteInfo) {
      modalParachuteInfo.classList.add('hidden');
      modalParachuteInfo.classList.remove('flex');
    }
    sound.playChime('click');
    hapticFeedback(15);
  }

  if (btnCloseParachuteInfo) btnCloseParachuteInfo.addEventListener('click', dismissParachuteInfo);
  if (btnDismissParachuteInfo) btnDismissParachuteInfo.addEventListener('click', dismissParachuteInfo);

  // ==========================================
  // 15. INITIALIZATION
  // ==========================================
  generateDialTicks();
  updateTimerInterface();
  updateParachuteCounters();
  renderSuitcaseTab();
  renderTowerTab();
  renderRoutinesTab();

  if (state.isLocked && state.lockSecondsRemaining > 0) {
    enterLockoutScreen();
    startCountdownTimer();
  } else {
    navigateToTab('focus');
  }

  // Expose global helpers for testing, WebView bridge and inspection
  window.state = state;
  window.navigateToTab = navigateToTab;
  window.triggerLockdown = triggerLockdown;
  window.exitLockoutToFocus = exitLockoutToFocus;
  window.blockWho = {
    state,
    navigateToTab,
    triggerLockdown,
    exitLockoutToFocus,
    saveState,
    updateTimerInterface
  };

  // Check first run permissions
  checkAndShowPermissionsOnboarding();

})();
