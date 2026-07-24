<div align="center">

# DiwakarOS

**The macOS-Desktop Experience in the Browser**

[![Live Demo](https://img.shields.io/badge/Live_Demo-os.diwakaryadav.com.np-007AFF?style=for-the-badge&logo=safari&logoColor=white)](https://os.diwakaryadav.com.np/)
[![Author](https://img.shields.io/badge/Author-Diwakar_Yadav-000000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Diwak4r)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-diwak4r-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/diwak4r)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

### Overview

**DiwakarOS** is an interactive, web-based operating system designed to reimagine personal portfolio presentation. Built using **React**, **Next.js**, and **Tailwind CSS**, it simulates a desktop environment equipped with window management, application state persistence, and native-feeling UI interactions.

### System Architecture

```mermaid
graph TD
    User([Browser Client]) --> OS[DiwakarOS Core System]
    OS --> WM[Window Manager]
    OS --> Dock[Interactive Dock & Menu Bar]
    OS --> AppRegistry[Application Registry]
    
    WM --> App1[Terminal App]
    WM --> App2[Portfolio Inspector]
    WM --> App3[Settings & Themes]
    WM --> App4[Media & Games]
```

### Core Features

- 🖥️ **Window Lifecycle Management:** Drag, resize, stack, minimize, and maximize application windows dynamically.
- 🌓 **Theme Engine:** Integrated dark/light mode toggle with native macOS translucent glassmorphism aesthetics.
- 🚀 **Performance Optimized:** Built with Next.js static asset optimizations for lightning-fast loads.

### Getting Started

```bash
# Clone repository
git clone https://github.com/Diwak4r/diwakaros.git

# Navigate & install
cd diwakaros
npm install

# Run dev server
npm run dev
```

---

<div align="center">
  <sub>Designed & Developed by <a href="https://github.com/Diwak4r">Diwakar Yadav</a></sub>
</div>
