# 💻 FamilyHub Frontend Dashboard

This directory houses the modern, high-fidelity React Single Page Application (SPA) that powers **FamilyHub**. It is optimized for high-performance wall-mounted tablets, smart-home dashboards, and mobile views.

---

## 🛠️ Technology Stack

1. **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) for robust static analysis.
2. **Build Tool**: [Vite](https://vite.dev/) for extremely fast Hot Module Replacement (HMR) and optimized rollup production bundles.
3. **Styling**: Vanilla CSS with custom CSS Custom Properties (Variables) for themed state control, rich micro-animations, and responsive layouts.
4. **Security & Cryptography**: Native **Web Crypto API (subtle)** for clientside secure AES-GCM 256-bit encryption.

---

## 🚀 Key Architectural Improvements

### 📺 1. Ticking Performance Isolation (Fridge Mode)
The wall-mounted "Fridge Mode" includes live ticking clocks, local calendars, and live weather indicators. To prevent full component-tree re-renders on every clock tick (every second), we implement isolated rendering scopes:
- The clock component operates on local state.
- Dynamic seasonal greetings execute local checks.
- Eliminates CPU/GPU rendering overhead on wall tablets, keeping memory utilization flat.

### 🔒 2. Secure Context & AES Cryptography
Modern browsers strictly restrict `window.crypto.subtle` to **Secure Contexts** (localhost or active HTTPS/SSL connections).
- **Proactive Fallback Audits**: The application checks for Secure Context capabilities at boot time.
- If in an insecure environment (e.g., standard HTTP over LAN), cryptographic components proactively warn the user and enforce secure routing to protect private family data.

---

## 📦 Local Development Scripts

Inside the `frontend` directory, you can run the following commands:

### `npm run dev`
Runs the application in development mode with active HMR.<br>
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### `npm run build`
Compiles and bundles the TypeScript and CSS assets into the highly optimized static folder `/dist` for production deployment.

### `npm run lint`
Runs ESLint to inspect, enforce code quality, and maintain standard TypeScript coding guidelines.

---

## 🎨 Design System
All UI tokens (colors, font sizes, transitions) are managed inside `/src/index.css` to guarantee maximum design consistency.
- **Vibrant Modern Palette**: Curated dark-themed glassmorphism and smooth gradient animations.
- **Premium Typography**: Structured around the beautiful, modern *Outfit* and *Inter* fonts.
