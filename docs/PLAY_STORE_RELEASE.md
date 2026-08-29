# Releasing VaatUp to Google Play

Everything in the repo is already configured for a production Android release. What is left is the part that needs your accounts and credentials.

## What is already done

| Item | Where | Value |
| --- | --- | --- |
| Application ID | `app.json` → `android.package` | `com.quicksplit.app` (see note below) |
| Display name | `app.json` → `name` | `VaatUp` |
| User-facing version | `app.json` → `version` | `1.0.0` |
| Build version | `app.json` → `android.versionCode` | `1` (then auto-incremented by EAS) |
| Launcher icon | `assets/images/android-icon-*.png` | Adaptive: foreground, background, monochrome |
| Splash screen | `expo-splash-screen` plugin | Brand green with light and dark variants |
| Orientation | `app.json` → `orientation` | `portrait` |
| Permissions | `app.json` → `android.permissions` / `blockedPermissions` | `INTERNET` and `VIBRATE` (haptics); storage, media, camera, microphone, and overlay are stripped |
| App visibility | `plugins/with-whatsapp-visibility.js` | Declares `com.whatsapp` and `com.whatsapp.w4b` in `<queries>` |
| Build profiles | `eas.json` | `development`, `preview` (APK), `production` (AAB) |
| Submit profile | `eas.json` → `submit.production.android` | Internal track, draft release |
| Hi-res store icon | `docs/store/play-store-icon-512.png` | 512×512 |
| Feature graphic | `docs/store/play-store-feature-graphic.png` | 1024×500 |
| Phone screenshots | `docs/screenshots/*.png` | 5 shots, 1215×2400, 24-bit PNG — **need re-shooting**, see below |
| Privacy policy | `docs/store/PRIVACY_POLICY.md` | Ready to publish |

The app declares **no dangerous permissions** and collects no data, which keeps the Data Safety form short. `VIBRATE` is a normal permission: it drives haptic feedback and never prompts the user. Receipts use Android's system photo picker, which returns the one photo the user selects without any media permission, so `READ_MEDIA_*` is blocked along with the camera and microphone permissions `expo-image-picker` would otherwise add.

Sign-in, expenses, people, groups, settlements, and receipts are all stored in a local SQLite database. Nothing is transmitted, so every Data Safety answer about collection and sharing remains "no" — including the account itself, which exists only on the device. `INTERNET` is added by React Native itself and is what the WhatsApp hand-off travels over; the app has no server of its own to call.

The screenshots in `docs/screenshots/` are the one asset the rename could not fix in place: they are photographs of the running app, so they still show the old wordmark in the header. They also predate the tab navigation, so they no longer match the app regardless of the name. Re-shoot all five before submitting. The launcher icon, splash image, and hi-res store icon are the ₹ glyph with no wordmark, so they carried over unchanged.

The application ID stays `com.quicksplit.app` even though the product is now VaatUp. On Google Play an application ID is permanent once a build is uploaded, and it is invisible to users — the launcher shows the display name. Changing it would create a second, unrelated listing rather than an update. The same reasoning keeps the iOS bundle identifier, the SQLite filename, and the AsyncStorage keys on their original names.

Android 11 and above hide installed apps from each other, so `plugins/with-whatsapp-visibility.js` names WhatsApp and WhatsApp Business in the manifest's `<queries>` block. Without it, `Linking.canOpenURL` reports WhatsApp as missing on a phone that has it, and sharing detours through the browser instead of opening the chat. Declaring a package this way grants no permission and needs no Play Console disclosure.

## Prerequisites

1. A Google Play Console developer account (one-time USD 25 fee) with the Developer Distribution Agreement accepted.
2. An [Expo account](https://expo.dev/signup) for EAS Build.
3. EAS CLI: use `npx eas-cli@latest <command>` — no global install needed.

## 1. Link the project to EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # creates the EAS project and writes extra.eas.projectId to app.json
```

## 2. Build the release bundle

```bash
npx eas-cli@latest build --platform android --profile production
```

This produces an `.aab`. On the first run EAS offers to generate an upload keystore — accept it, and EAS stores and reuses it for every later build. Back it up:

```bash
npx eas-cli@latest credentials    # Android → keystore → download / view
```

Losing the keystore means you can never update the listing under the same app, so keep the backup somewhere safe. (If you enable Play App Signing, Google holds the app signing key and this keystore is only the upload key, which can be reset by support.)

To sanity-check the release build on a device before submitting, build the internal profile instead — it produces an installable APK:

```bash
npx eas-cli@latest build --platform android --profile preview
```

## 3. Create the app in Play Console

**All apps → Create app**

- App name: `VaatUp`
- Default language: English (India) or English (United States)
- App or game: App
- Free or paid: Free
- Declarations: confirm the developer programme policies and US export laws

## 4. First upload

For the very first release, Play requires the AAB to be uploaded by hand (an app must exist before the API can target it):

**Testing → Internal testing → Create new release → Upload** the `.aab` from step 2.

After that first upload, later releases can go straight from the CLI:

```bash
npx eas-cli@latest submit --platform android --profile production --latest
```

This needs a Google service account key; follow <https://expo.fyi/creating-google-service-account>, save the JSON outside the repo, and point `submit.production.android.serviceAccountKeyPath` in `eas.json` at it. **Never commit that JSON.**

## 5. Store listing

**Grow → Store presence → Main store listing**

- **App name:** `VaatUp`
- **Short description (max 80):**

```text
Split any bill and send everyone their share on WhatsApp in seconds.
```

- **Full description (max 4000):**

```text
VaatUp does one thing well: you just paid the bill, and now everyone needs to know what they owe you.

Type the amount, add the people, pick how to split it, and send each person their share on WhatsApp. It takes under a minute.

SPLIT THREE WAYS
• Equal — the rounding is exact, so ₹1,000 across three people comes out as ₹333.34, ₹333.33 and ₹333.33. The shares always add up to the total.
• Custom — type each person's amount. VaatUp shows exactly how much is left and won't let you finish until it balances.
• Percentage — split 40/20/20/20 and VaatUp works out the amounts.

TIP AND TAX
Add a 5%, 10% or 15% tip, a flat amount, or skip it. Add tax separately when it isn't already on the bill.

STRAIGHT TO WHATSAPP
Each person gets their own message with the bill name, the total, everyone's share, and their own amount highlighted. VaatUp opens WhatsApp with the message ready — you read it and press send yourself. Nothing is ever sent automatically.

Or use Share summary to send the whole split through any app: a WhatsApp group, Telegram, SMS or email.

BUILT TO STAY OUT OF THE WAY
• No account, no sign-up, no ads
• Works offline — everything stays on your phone
• Your recent splits are saved so you can reopen and edit them
• Remembers the people you split with, so you type a number once

VaatUp is not an expense tracker, a social network or a payments app. It's the fastest way from "I paid" to "here's what you owe me".
```

- **App icon:** `docs/store/play-store-icon-512.png`
- **Feature graphic:** `docs/store/play-store-feature-graphic.png`
- **Phone screenshots:** at least 2, use `docs/screenshots/1-home.png`, `2-create-bill.png`, `4-split.png`, `5-result.png` (1215×2400, inside Play's 2:1 limit, no alpha channel)
- **App category:** Finance (Tools is also acceptable)
- **Tags:** bill splitting, expenses, utilities
- **Contact email:** your support address
- **Privacy policy:** required for every app. VaatUp collects nothing, so a short hosted page is enough — see `docs/store/PRIVACY_POLICY.md` for text you can publish.

## 6. App content declarations

**Policy → App content**

| Section | Answer |
| --- | --- |
| Privacy policy | URL of your published policy |
| Ads | No ads |
| App access | All functionality available without restrictions (no login) |
| Content rating | Complete the questionnaire — a utility with no user content rates 3+ / Everyone |
| Target audience | 18+ (or 13+) — not designed for children, so answer "No" to appealing to children |
| News app | No |
| Data safety | **No data collected, no data shared.** Bills, phone numbers, and the user's own optional UPI ID stay in the app's own storage on the device and are never transmitted by VaatUp. Phone numbers are used only to build a WhatsApp link that the user then sends themselves. Play's "collected" means sent off the device, which nothing here is. |
| Government app | No |
| Financial features | No — VaatUp does not process payments, lend, or handle financial accounts. The optional UPI feature only writes a `upi://pay` request into a message or QR code; the payer's own bank app performs the transfer, and VaatUp holds no credentials and touches no payment network. |
| Health | No |

## 7. Roll out

1. Internal testing → add testers by email → verify install and the WhatsApp hand-off on a real device.
2. Promote to Closed or Open testing if you want wider feedback.
3. Production → Create release → roll out (a staged 20% rollout is a safe default).

Google review for a first submission typically takes a few days.

## Release checklist for later versions

1. Bump `version` in `app.json` for anything user-visible (`versionCode` is auto-incremented by EAS because `eas.json` sets `appVersionSource: "remote"` and `autoIncrement: true`).
2. `npm run lint && npm run typecheck && npm test`
3. `npx eas-cli@latest build --platform android --profile production`
4. `npx eas-cli@latest submit --platform android --profile production --latest`
5. Update the "What's new" release notes in Play Console.
