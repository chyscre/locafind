# LocaFind

A campus lost-and-found mobile app for NEUST Sumacab, inspired by location-based games.
Lost items appear as mystery orbs on a 3D campus map and unlock when you walk into their
search perimeter. Built with Ionic Angular, Capacitor (Camera, Geolocation, Haptics),
Leaflet, and a PHP + MySQL API.

## Case Study Deliverables

| Deliverable | File |
| --- | --- |
| Video presentation (14 min) | [`deliverables/LOCAFind_Presentation_Video.mp4`](deliverables/LOCAFind_Presentation_Video.mp4) |
| Presentation slides | [`deliverables/LOCAFind_Presentation.pptx`](deliverables/LOCAFind_Presentation.pptx) |
| Document (project concept) | [`docs/LocaFind_Project_Concept.pdf`](docs/LocaFind_Project_Concept.pdf) |
| APK (Android) | [`apk/LocaFind-v1.2.apk`](apk/LocaFind-v1.2.apk) |
| Source code | this repository: app in [`src/`](src), Android project in [`android/`](android), PHP API in [`backend/`](backend) |

**Testing the APK away from our network:** the APK connects to our XAMPP server on our Wi-Fi.
On any other network it switches to offline mode with sample reports. Choose **Continue as guest**,
then turn on **Profile → Demo mode** and tap the map to walk to an item.

The app demo in the video was recorded with the real app build and PHP API; only the GPS
position was simulated along a campus path, as noted on screen.

- **Install on Android:** download [`apk/LocaFind-v1.2.apk`](apk/LocaFind-v1.2.apk) on the phone,
  open it, and allow "Install unknown apps" (Android 7.0 or newer). Sign up with your student
  number on first launch, or continue as a guest.
- Concept document: [`docs/LocaFind_Project_Concept.pdf`](docs/LocaFind_Project_Concept.pdf)
- Backend setup (XAMPP): [`backend/README.md`](backend/README.md)

## Set up on a new computer

1. Install [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com), and
   [Android Studio](https://developer.android.com/studio) (run its setup wizard once).
2. Clone and install:
   ```bash
   git clone https://github.com/chyscre/locafind.git
   cd locafind
   npm install
   ```
3. Run in the browser:
   ```bash
   npx ionic serve
   ```
4. Database: install XAMPP, then follow [`backend/README.md`](backend/README.md).

## Run on an Android phone

1. Set the laptop's Wi-Fi IP in `src/environments/environment.prod.ts` (`apiUrl`).
2. Build and copy the web app into the Android project:
   ```bash
   npx ionic build
   npx cap sync android
   npx cap open android
   ```
3. In Android Studio, pick the phone and press **Run**, or use
   **Build > Generate App Bundles or APKs > Generate APKs** to get an installable APK.

## About the APK

The APK reaches the database at the laptop running XAMPP (`apiUrl` in
`src/environments/environment.prod.ts`, currently `192.168.1.11`). On another Wi-Fi, or when
that laptop is off, the app runs in **offline mode** with sample reports, and new reports stay on
that phone. Everything else (map, avatar, camera, Demo mode, test items) still works.

## Testing away from campus

- **Profile > Testing > Place test items around me**: puts pretend items 25–130 m around
  you; walk toward them with real GPS.
- **Profile > Demo mode**: places you on campus; tap the map to walk.
