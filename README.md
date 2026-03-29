# 🚛 TruckPilot

**TruckPilot** is an external **navigation + dashboard system** for Euro Truck Simulator 2(not tested as I don't own ETS2) and American Truck Simulator built using Typescript. It runs in the browser (perfect for a second monitor, tablet or phone) or standalone app and provides real-time tracking, routing, and live truck data based on the in-game map.

---

# Current Status: Work in Progress

Please consider this project a **Beta**.

While the core navigation and dashboard features work, the project is still evolving.

* **Bugs are expected:** This project has been heavily modified and extended, so there may still be issues.
* **Routing Quirks:** The navigation system is still being refined. Routes may occasionally be suboptimal or slightly inaccurate.
* **Ongoing Improvements:** Navigation, dashboard features, and overall stability are actively being improved.
* **Known Quirks:** Inside company areas, it may help to move the truck slightly outside before setting a route.

---

# Known Issues & Limitations

### ⚠️ Common Quirks
*   **Routing Logic:** May occasionally take unusual routes due to map graph limitations.
*   **Company Areas:** Routing may fail if you're deep inside a company yard.
*   **Map Gaps:** Some missing or imperfect road connections may exist.

---

### 📱 Performance & Compatibility
> [!NOTE]
>*  **Performance:** Optimization is ongoing. Lower-end devices may experience lag.
>*  **Map Support:** Supports base ETS2/ATS + DLCs. ProMods and other map mods are not supported.

---

# 🚀 What’s New in TruckPilot

### 📊 Dashboard (NEW)
- Live truck data (speed, fuel, etc.)
- Job tracking
- Combined navigation + dashboard view

---

### 🧭 Improved Navigation
- Turn-by-turn guidance
- More driver-focused distance calculations
- Custom destination routing

---

### 🏢 Real Company Support
Works with:
- **Real Companies, Gas Stations & Billboards v4.01.17**

---

### 🖥️ Designed for Second Monitor
- Perfect for sim rigs
- Works on tablets, phones, or secondary screens

---

### 🔧 Custom Telemetry System
TruckPilot now uses a custom telemetry server instead of the original one:

👉 https://github.com/Jonesyj83/trucksim-gps-server

---

# Installation via .exe File

1. Download the latest setup file from your repository releases.

2. Run the installer.

3. Launch **TruckPilot**.

4. Install the telemetry server (see below).

5. Open the app on another device or second monitor using the IP shown.

---

# Telemetry Setup (IMPORTANT)

You must install the telemetry server:

👉 https://github.com/Jonesyj83/trucksim-gps-server

Follow its instructions to install and run it.

---

# Instalation via nodejs

## Prerequisites

1. **Node.js (LTS Version)**  
   https://nodejs.org/

2. **Git**  
   https://git-scm.com/

---

## Installation

### 1. Get the Code

```bash
git clone https://github.com/jonesyj83/truckpilot.git
cd truckpilot
```
**Option B: Download ZIP**
1. Click the Code button at the top of this page and select `Download ZIP`.
2. Extract the files to a folder on your computer.
3. Open that folder in your terminal or VS Code.

### 2. Prepare the Environment (Windows Users)
If you are on Windows, you may need to run the following commands to ensure the installation proceeds without problems.

**PowerShell Script Execution:**

If you encounter errors regarding disabled scripts in PowerShell, run one of the following commands as Administrator:
*Temporary Fix (Recommended):*
```Powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
*Permanent Fix:*
```Powershell
Set-ExecutionPolicy RemoteSigned
```

### 3. Install Dependencies
```bash
npm install
```

## Running the App
Start the development server with the following command and wait for the Ets2 Telemetry server to clone:
```Bash
npx nuxi dev --host 0.0.0.0
```
Follow the instructions from the opened .exe to install the telemetry plugin DLLs into your game directory.

> [!NOTE]
> **Troubleshooting:**
> If somehow the installation of the telemetry server fails, you can install it manually:
> 1. Download and the server from the [Funbits Telemetry Server Repo](https://github.com/Funbit/ets2-telemetry-server).
> 2. Extract the .zip into the root folder of this project.
> 3. Rename it: `ets2-telemetry-server'.

## Accessing the App in Your Browser
To open the app in your browser, click the network link shown in the terminal (the local link may have telemetry fetching issues):
```Bash
➜ Network: http://192.168.1.x:3000/
```

#  How it Works

1. **Telemetry:** Reads live data from the game (position, speed, heading)
2.  **Mapping:** Converts game coordinates into a usable map projection
3.  **Routing:** Uses a custom graph to calculate routes


# How You Can Help Improve the Map

If you test the application and encounter broken intersections, missing road connections, roundabout issues, or strange routing behavior, you can help improve the navigation by reporting what you find.

### What to Report
- Description 
- Coordinates
- Screenshot

**Note:**  
Reported issues will be addressed as time permits.

# Credits & Acknowledgements

This project stands on the shoulders of giants. A massive thank you to the following developers who made this possible:

### [@Rares-Muntean](https://github.com/Rares-Muntean)
Original Project **['TruckNav-Sim'](https://github.com/Rares-Muntean/TruckNav-Sim)**
*   Core concept and base implementation

### [@truckermudgeon](https://github.com/truckermudgeon)
Special thanks for the **['maps'](https://github.com/truckermudgeon/maps)** repository.
*   This provided the essential starting point for map parsing.
*   The logic for converting internal game coordinates to a usable format (WGS84) was invaluable for getting the map rendered correctly.

### [@Funbit](https://github.com/Funbit)
Thanks for the **['ets2-telemetry-server'](https://github.com/Funbit/ets2-telemetry-server)**.
*   This tool is the bridge that allows the browser to communicate with the game engine. Without this, we wouldn't have live truck data.

---

*Drive safe, and happy trucking!* 
