# Umbra pentru Android

Aplicația Umbra rulează într-un WebView local. Camera este accesată numai după acordarea permisiunii Android.
Imaginea este procesată local; efectul termic este o simulare după luminozitate, nu o măsurare IR.
Aplicația nu cere permisiunea INTERNET și nu trimite date. Permisiuni: CAMERA și VIBRATE.

Funcții: Scanner (cameră cu efect termic simulat, detectare mișcare, capturi), Instrumente (detector EMF cu senzorul magnetic real, cutia spiritelor simulată, sunet), Jurnal (sesiuni, note, raport), Setări. Interfața este în `app/src/main/assets` (`index.html`, `styles.css`, `app.js`); puntea către senzor este `NativeBridge` din `MainActivity.java`.

**Pentru Google Play, urmează `PUBLICARE-GOOGLE-PLAY.md`.**

## Build rapid

- **Android Studio** (JDK 17): deschide folderul, apoi *Build → Build Bundle(s) / APK(s)*.
- **Linia de comandă**: `./gradlew assembleDebug` (APK de test) sau `./gradlew bundleRelease` (AAB pentru Play).
- **GitHub Actions**: vezi `.github/workflows/build-apk.yml` și ghidul de publicare.

Cerințe: Android SDK Platform 36, JDK 17, Gradle 8.13 (inclus prin `gradlew`).

## Conținut

- `app/` — proiectul Android (cod, resurse, aplicația web în `src/main/assets`)
- `play-assets/` — iconița 512×512, imaginea de prezentare, capturi și politica de confidențialitate
- `PUBLICARE-GOOGLE-PLAY.md` — pașii complet, texte pentru listare, răspunsuri Data safety
