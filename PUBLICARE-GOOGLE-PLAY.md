# Umbra — publicare pe Google Play

> **Important:** proiectul a fost pregătit și verificat (sintaxă XML/YAML/JS, testul aplicației web cu cameră simulată), dar **nu a putut fi compilat** în mediul în care a fost lucrat (fără acces la Android SDK). Prima rulare a build-ului pe GitHub confirmă totul. Dacă apare o eroare, trimite logul și o rezolv.

## Ce s-a schimbat față de proiectul original

| Subiect | Înainte | Acum |
|---|---|---|
| Nivel API | 35 | **36** (cerut de Google Play pentru aplicații noi de la 31 aug. 2026) |
| Android Gradle Plugin / Gradle | 8.7.3 | **8.13.0 / Gradle 8.13**, JDK 17, cu `gradlew` inclus |
| Format publicare | APK de debug | **AAB semnat** (release, cu R8) + APK de test |
| Iconiță | lipsă | iconiță adaptivă (+ monocromă) și iconiță Play 512×512 |
| Marginile ecranului | fără tratare | tratate pentru Android 15/16 (edge-to-edge) |
| Tasta „înapoi” | `onBackPressed` | gest „înapoi” predictiv (Android 13+) |
| Securitate WebView | implicit | fără acces la fișiere, navigare blocată în afara aplicației, permisiuni doar pentru conținutul local |
| Fonturi | încărcate de la Google Fonts | **scos**; aplicația nu mai conține nicio adresă web |
| **Interfață** | un singur ecran | aplicație cu 4 secțiuni: Scanner (cameră + 4 palete + detectare mișcare + capturi), Instrumente (detector EMF real, cutia spiritelor, sunet), Jurnal (sesiuni, cronologie, note, raport distribuibil), Setări; ecran de introducere cu avertisment de divertisment; fără alert/confirm |
| **Senzor** | niciunul | citire reală a senzorului magnetic prin punte nativă (`UmbraNative`) |
| **Eroare JavaScript** | o acoladă `}` în plus la ultima linie a scriptului | **reparată**. În versiunea originală scriptul nu se încărca deloc, deci niciun buton nu funcționa |

## Pasul 1 — Creează cheia de încărcare (o singură dată)

Pe calculatorul tău (necesită Java; vine cu Android Studio):

```
keytool -genkeypair -v -keystore upload.keystore -alias umbra -keyalg RSA -keysize 2048 -validity 10000
```

- Alege o parolă și **păstreaz-o**. Păstrează `upload.keystore` în cel puțin două locuri sigure (nu în GitHub și nu în arhivă).
- Folosește **Play App Signing** (implicit în Play Console): Google păstrează cheia finală, iar tu ai doar cheia de încărcare. Dacă o pierzi, o poți reseta prin suport.

## Pasul 2 — Construiește AAB-ul pe GitHub

1. Creează un repository **privat** pe GitHub și urcă tot conținutul acestui folder, inclusiv `.github` și `gradlew`.
2. **Settings → Secrets and variables → Actions → New repository secret**. Adaugă patru secrete:
   - `UMBRA_KEYSTORE_BASE64`: rezultatul comenzii `base64 -w0 upload.keystore` (pe macOS: `base64 -i upload.keystore`)
   - `UMBRA_KEYSTORE_PASSWORD`: parola keystore-ului
   - `UMBRA_KEY_ALIAS`: `umbra`
   - `UMBRA_KEY_PASSWORD`: parola cheii (aceeași, dacă nu ai ales alta)
3. **Actions → Build Umbra → Run workflow**.
4. După câteva minute, descarcă artefactul **Umbra-release-aab** (conține `app-release.aab`). Mai găsești **Umbra-debug-apk** (pentru test direct pe telefon) și **Umbra-mapping**.

Fără secrete, build-ul reușește, dar AAB-ul este nesemnat și Play îl refuză (workflow-ul afișează un avertisment).

## Pasul 3 — Politica de confidențialitate

Google o cere, pentru că aplicația folosește camera. Fișierul este `play-assets/politica-de-confidentialitate.html`.

1. Înlocuiește `[NUMELE TĂU SAU AL FIRMEI]` și `[EMAIL DE CONTACT]` (apar de două ori).
2. Pune-o online la o adresă publică, de exemplu pe Netlify, ca site-ul Gustoșar (tragi folderul pe app.netlify.com/drop), și copiază adresa.

## Pasul 4 — Contul și aplicația în Play Console

1. Cont de dezvoltator: taxă unică de 25 USD și verificarea identității.
2. **Create app**: nume, limba implicită (română), „App”, „Free”.
3. **Dashboard** completează secțiunile cerute:
   - **Privacy policy**: adresa de la pasul 3.
   - **App access**: toate funcțiile sunt accesibile fără cont.
   - **Ads**: nu conține reclame.
   - **Content rating**: chestionar IARC. Aplicația nu are violență, conținut sexual sau interacțiuni între utilizatori. Subiectul „paranormal” este doar tematic. Răspunde corect la fiecare întrebare.
   - **Target audience**: alege grupa de vârstă potrivită (nu alege „sub 13 ani” dacă nu vrei cerințele pentru copii).
   - **Data safety**: vezi mai jos.
   - **Category**: Entertainment.
4. **Store listing**: texte mai jos, iconița, imaginea de prezentare și capturile din `play-assets/`.
5. **Testing → Closed testing**: încarcă AAB-ul și adaugă testeri.

### Cerința pentru conturi personale noi

Conform Google ([ajutor Play Console](https://support.google.com/googleplay/android-developer/answer/14151465)), un cont personal creat după 13 noiembrie 2023 trebuie să ruleze un **test închis cu minimum 12 testeri înscriși continuu timp de 14 zile**, înainte să ceri acces la producție. Un cont de organizație nu are această cerință. Verifică regulile curente în Play Console, ele se pot schimba.

### Data safety (răspunsuri recomandate)

- *Does your app collect or share any of the required user data types?* **No**. Imaginea camerei, citirile senzorului și jurnalul rămân pe dispozitiv și nu sunt trimise nicăieri (nu se consideră „colectare” conform definiției Google când datele nu părăsesc dispozitivul). Aplicația nici nu are permisiunea INTERNET.
- *Is all of the user data encrypted in transit?* Nu se aplică (nu se transmit date).
- *Do you provide a way for users to request data deletion?* Nu se aplică.

Verifică formularul în Play Console, întrebările pot arăta puțin diferit.

## Texte pentru listare

**Titlu (max. 30 caractere):** `Umbra: Investigator paranormal`

**Descriere scurtă (max. 80 caractere):**
`Instrumente de investigație paranormală pentru distracție: cameră, EMF, jurnal.`

**Descriere completă:**

```
Umbra este un set de instrumente pentru „vânători de fantome”, creat pentru distracție și atmosferă.

Ce poți face:
• Scanner: pornești camera și vezi lumea printr-o paletă termică simulată (termic, noapte, ultraviolet, alb-negru), cu indicator de mișcare și capturi
• Detector EMF: citește câmpul magnetic măsurat de senzorul telefonului, cu grafic și calibrare
• Cutia spiritelor: un joc cu cuvinte alese la întâmplare
• Sunet ambiental misterios, generat de aplicație
• Jurnal de investigații: sesiuni cu cronologie, note și capturi, plus un raport pe care îl poți trimite prietenilor

Important de știut:
Umbra este o aplicație de divertisment. Efectul termic și cutia spiritelor sunt simulări. Telefoanele obișnuite nu măsoară temperatura și nu detectează infraroșu. Detectorul EMF arată câmpul magnetic real, dar acesta este influențat de metal, magneți și aparate electrice; nu dovedește existența fantomelor. Aplicația nu detectează fenomene paranormale.

Confidențialitate:
Totul rămâne pe telefonul tău. Fără conturi, reclame sau urmărire, fără microfon și fără acces la internet.
```

(Nu scrie în titlu sau descriere că aplicația „măsoară temperatura” sau „detectează fantome”: Google interzice descrierile înșelătoare.)

## Înainte de lansare

- [ ] Înlocuiește capturile din `play-assets/` cu capturi făcute pe telefon. Cele incluse sunt generate pe calculator, cu o imagine de test în loc de cameră reală; Play cere minimum 2 capturi reale, fidele aplicației.
- [ ] Pe un telefon fără senzor magnetic, detectorul EMF arată „DEMO” (valori simulate, etichetate). Testează pe un telefon cu senzor, mișcând un magnet sau un obiect metalic lângă el.
- [ ] `applicationId` (`ro.umbra.app`) nu se mai poate schimba după publicare. Dacă vrei alt nume, modifică-l în `app/build.gradle` acum.
- [ ] Politica de confidențialitate spune că aplicația nu are permisiunea INTERNET. După build, verifică în Android Studio (*Build → Analyze APK → AndroidManifest.xml*) că singurele permisiuni sunt `CAMERA` și `VIBRATE`.
- [ ] Testează `app-debug.apk` pe un telefon real: permisiunea camerei, efectul, sunetul, gestul „înapoi”, marginile ecranului.
- [ ] La fiecare actualizare crește `versionCode` în `app/build.gradle`.
