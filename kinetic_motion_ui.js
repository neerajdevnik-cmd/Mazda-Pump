/* ============================================================================
   MAZDA OIL COMPANY — KINETIC MOTION UI & 3D COMMAND CENTER (Pro v7.0)
   High-class Kinetic Typography, Animated Fuel Tank Waves, 3D Tilt & Counters
   ============================================================================ */
(function() {
  'use strict';

  // 1. Inject Ultra-Premium CSS & Kinetic Typography Styles (Preserves all v1-v3 styles)
  const injectProStyles = () => {
    if (document.getElementById('mazda-pro-v7-css')) return;
    const style = document.createElement('style');
    style.id = 'mazda-pro-v7-css';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');

      :root {
        --pro-gold: #f4b41a;
        --pro-gold-glow: rgba(244, 180, 26, 0.45);
        --pro-navy: #06183d;
        --pro-cyan: #00e5ff;
        --pro-emerald: #10b981;
      }

      /* Kinetic Typography Number Display */
      .kinetic-num, .big, .ledger-box b, .cb-score {
        font-family: 'Orbitron', 'Plus Jakarta Sans', system-ui, sans-serif !important;
        letter-spacing: 0.4px;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.25s ease;
      }
      .kinetic-pulse {
        animation: kineticScale 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes kineticScale {
        0% { transform: scale(1); }
        45% { transform: scale(1.12); text-shadow: 0 0 18px var(--pro-gold-glow); }
        100% { transform: scale(1); }
      }

      /* Animated Shimmer Header & Gold Rim */
      header {
        background: linear-gradient(125deg, #04102b 0%, #0a2966 48%, #134dc2 85%, #071f4d 100%) !important;
        background-size: 200% 200% !important;
        animation: headerGradientFlow 10s ease infinite !important;
      }
      @keyframes headerGradientFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      /* High-Class Glassmorphic Card Micro-Interactions */
      .card {
        transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease, border-color 0.22s ease !important;
        position: relative;
        overflow: hidden;
      }
      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(10, 42, 102, 0.14) !important;
        border-color: rgba(244, 180, 26, 0.35) !important;
      }

      /* Pro v7 Floating Dock Launcher */
      .pro-v7-launcher {
        position: fixed;
        right: 14px;
        bottom: 92px;
        z-index: 45;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: flex-end;
      }
      .pro-fab {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 11px 16px;
        border-radius: 999px;
        border: 1.5px solid rgba(255, 211, 92, 0.75);
        background: linear-gradient(135deg, #071a42 0%, #0f388a 60%, #1958d4 100%);
        color: #fff;
        font-weight: 800;
        font-size: 13.5px;
        box-shadow: 0 8px 25px rgba(7, 26, 66, 0.55), 0 0 15px rgba(244, 180, 26, 0.3);
        cursor: pointer;
        transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .pro-fab:active { transform: scale(0.94); }
      .pro-fab .badge-dot {
        width: 9px; height: 9px; border-radius: 50%;
        background: #00e676;
        box-shadow: 0 0 10px #00e676;
        animation: pulseDot 1.6s infinite;
      }
      @keyframes pulseDot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.4); opacity: 0.55; }
      }

      /* Live Command Center Banner */
      .pro-command-bar {
        background: linear-gradient(135deg, #051331 0%, #0b2963 55%, #123e91 100%);
        color: #fff;
        border-radius: 20px;
        padding: 16px;
        margin: 0 0 16px;
        border: 1px solid rgba(244, 180, 26, 0.4);
        box-shadow: 0 14px 34px rgba(5, 19, 49, 0.35);
        position: relative;
        overflow: hidden;
      }
      .pro-command-bar::before {
        content: "";
        position: absolute;
        top: -50%; left: -50%; width: 200%; height: 200%;
        background: radial-gradient(circle at center, rgba(244,180,26,0.12) 0%, transparent 55%);
        pointer-events: none;
      }
      .pro-cmd-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .pro-cmd-title {
        font-size: 15px;
        font-weight: 800;
        color: #ffd35c;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pro-cmd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
        gap: 10px;
      }
      .pro-tank-widget {
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        padding: 10px 12px;
        position: relative;
        overflow: hidden;
      }
      .pro-tank-wave {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        height: var(--fill, 65%);
        background: linear-gradient(180deg, rgba(0, 229, 255, 0.22), rgba(16, 185, 129, 0.32));
        transition: height 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        pointer-events: none;
      }
      .pro-tank-widget.ms .pro-tank-wave {
        background: linear-gradient(180deg, rgba(244, 180, 26, 0.25), rgba(239, 68, 68, 0.28));
      }
      .pro-cmd-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .pro-cmd-btn {
        flex: 1;
        min-width: 125px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(244, 180, 26, 0.45);
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: 0.2s;
      }
      .pro-cmd-btn:hover, .pro-cmd-btn:active {
        background: linear-gradient(180deg, #ffd35c, #f4b41a);
        color: #06183d;
      }
    `;
    document.head.appendChild(style);
  };

  // 2. Kinetic Number Counter Engine
  window.animateKineticValue = function(el, targetVal, prefix = '', suffix = '', duration = 650) {
    if (!el) return;
    const end = parseFloat(String(targetVal).replace(/[^0-9.-]/g, '')) || 0;
    const start = 0;
    const startTime = performance.now();
    el.classList.add('kinetic-num', 'kinetic-pulse');

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      const formatted = Number.isInteger(end)
        ? Math.round(current).toLocaleString('en-IN')
        : current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      el.textContent = `${prefix}${formatted}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
      else setTimeout(() => el.classList.remove('kinetic-pulse'), 250);
    };
    requestAnimationFrame(step);
  };

  // 3. Inject Interactive Command Center Bar on Main Screen
  const injectCommandCenter = () => {
    const main = document.querySelector('main');
    if (!main || document.getElementById('mazda-pro-cmd-bar')) return;

    const state = window.S || window.state || {};
    const msRate = (state.rates && (state.rates.petrol || state.rates.ms)) || localStorage.getItem('mazda_ms_rate') || '94.65';
    const hsdRate = (state.rates && (state.rates.diesel || state.rates.hsd)) || localStorage.getItem('mazda_hsd_rate') || '87.52';

    const bar = document.createElement('div');
    bar.id = 'mazda-pro-cmd-bar';
    bar.className = 'pro-command-bar';
    bar.innerHTML = `
      <div class="pro-cmd-top">
        <div class="pro-cmd-title">
          <span>⚡ MAZDA OIL COMPANY • PRO COMMAND v7.0</span>
        </div>
        <span style="font-size:11.5px;background:rgba(244,180,26,0.2);color:#ffd35c;padding:3px 10px;border-radius:99px;font-weight:700;">
          Bamsyun, Ranikhet Road
        </span>
      </div>
      <div class="pro-cmd-grid">
        <div class="pro-tank-widget ms" style="--fill:74%">
          <div class="pro-tank-wave"></div>
          <div style="position:relative;z-index:1;">
            <small style="opacity:0.8;font-size:11px;">⛽ PETROL (MS) RATE</small>
            <div class="kinetic-num" style="font-size:20px;font-weight:900;color:#ffd35c;">₹${msRate}/L</div>
            <small style="font-size:10.5px;color:#cbd5e1;">Live Kinetic Sync</small>
          </div>
        </div>
        <div class="pro-tank-widget hsd" style="--fill:68%">
          <div class="pro-tank-wave"></div>
          <div style="position:relative;z-index:1;">
            <small style="opacity:0.8;font-size:11px;">🚛 DIESEL (HSD) RATE</small>
            <div class="kinetic-num" style="font-size:20px;font-weight:900;color:#38bdf8;">₹${hsdRate}/L</div>
            <small style="font-size:10.5px;color:#cbd5e1;">Pahad Fleet Active</small>
          </div>
        </div>
      </div>
      <div class="pro-cmd-actions">
        <button class="pro-cmd-btn" onclick="window.openMazdaPosterStudio && window.openMazdaPosterStudio('daily')">
          🎨 Daily Rate & Quote Poster
        </button>
        <button class="pro-cmd-btn" onclick="window.openMazdaPosterStudio && window.openMazdaPosterStudio('loyalty')">
          🏆 Customer VIP Dhanyawad Card
        </button>
        <button class="pro-cmd-btn" onclick="window.openMazdaPosterStudio && window.openMazdaPosterStudio('festival')">
          🪔 Festival Wishes (Bulk + Name)
        </button>
        <button class="pro-cmd-btn" onclick="window.openMazdaProGrowthHub && window.openMazdaProGrowthHub()">
          🚀 10x Sales & Pro Ops Hub
        </button>
      </div>
    `;
    main.prepend(bar);
  };

  // 4. Floating Quick-Access Dock
  const injectFloatingLauncher = () => {
    if (document.getElementById('mazda-pro-dock')) return;
    const dock = document.createElement('div');
    dock.id = 'mazda-pro-dock';
    dock.className = 'pro-v7-launcher';
    dock.innerHTML = `
      <button class="pro-fab" onclick="window.openMazdaPosterStudio && window.openMazdaPosterStudio('daily')" title="Poster & Status Studio">
        <span class="badge-dot"></span>
        <span>🎨 Poster Studio</span>
      </button>
      <button class="pro-fab" onclick="window.openMazdaProGrowthHub && window.openMazdaProGrowthHub()" title="10x Sales & Pro Tools">
        <span>🚀 10x Pro Hub</span>
      </button>
    `;
    document.body.appendChild(dock);
  };

  // Observe DOM renders so Command Center stays visible across SPA tab switches
  const initProUI = () => {
    injectProStyles();
    injectFloatingLauncher();
    injectCommandCenter();

    const appRoot = document.getElementById('app') || document.body;
    const observer = new MutationObserver(() => {
      if (document.querySelector('main') && !document.getElementById('mazda-pro-cmd-bar')) {
        injectCommandCenter();
      }
    });
    observer.observe(appRoot, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProUI);
  } else {
    initProUI();
  }
})();
