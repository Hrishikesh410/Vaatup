# VaatUp Privacy Policy

_Last updated: 29 August 2026_

VaatUp is an expense-splitting utility. Your account and your data live on your device: there are no servers and no analytics. This policy explains exactly what happens to the information you type in.

## What VaatUp stores

Everything you enter stays on your device, in the app's own private database:

- **Your account** — the name and email address you sign up with, and your password stored only as a salted hash. This account is created and checked on your device; it is never registered anywhere else.
- **Expenses** — the description, amount, tip, tax, category, notes, who paid, each person's share, and any comments you add.
- **People and groups** — the names and, optionally, the phone numbers and email addresses you type in yourself, and the groups you sort them into.
- **Payments** — the settlements you record when someone pays you back, or you pay them.
- **Receipts** — if you attach a photo to an expense, a copy of that photo is kept in the app's own private storage.
- **Your UPI ID** — only if you add one under **Payment details**, so VaatUp can tell people where to send your money.

Nothing is uploaded. VaatUp has no backend, so there is no server that could receive your data.

## What VaatUp does not do

- It does **not** collect or transmit personal data. Your sign-in never leaves the device.
- It does **not** read your device contacts or address book. Every name and number is one you typed.
- It does **not** contain ads, trackers, or analytics SDKs.
- It does **not** read your photo library. Attaching a receipt opens your device's own photo picker, and only the photo you choose is copied in.
- It does **not** process payments or connect to any bank or UPI service.
- It does **not** send WhatsApp messages on your behalf.
- It does **not** ask for, store, or display anyone else's payment details.

## How phone numbers are used

A phone number is only used to build a WhatsApp link for that person. When you tap **WhatsApp**, VaatUp opens WhatsApp with a message already written, addressed to that number. You read the message and press send yourself, inside WhatsApp. VaatUp never sends anything automatically and never transmits the number anywhere else.

When you use **Share summary**, your device's own share sheet takes over, and the plain-text summary goes wherever you choose to send it. That transfer is handled by the app you pick, under that app's own privacy policy.

## How your UPI ID is used

Adding a UPI ID is optional, and it is only ever used to ask for money owed to you. VaatUp uses it in two places, both of which you trigger:

- As one line of text in the message you send — "Pay ₹500 to your-id@bank".
- As a QR code drawn on your screen, encoding a standard `upi://pay` request for that person's exact share.

VaatUp is not a payment app. It holds no bank credentials, moves no money, and contacts no payment network. Paying happens entirely inside the payer's own UPI app, and the money goes from their bank to yours. You can switch the message line off, or delete your UPI ID from the app, at any time under **Payment details**.

## Third parties

VaatUp hands off to other apps you already have installed — WhatsApp, or whatever you select in the share sheet. Once information leaves VaatUp through your deliberate action, it is governed by that app's privacy policy:

- WhatsApp: <https://www.whatsapp.com/legal/privacy-policy>

## Permissions

VaatUp requests no runtime permissions. It does not ask for contacts, storage, camera, location, or notifications. Attaching a receipt uses your device's built-in photo picker, which hands over the single photo you select without granting the app access to your library, so no permission prompt appears. On Android the app declares vibration, which is used only for the small taps you feel when marking a share paid or opening WhatsApp, and which never prompts you or reveals anything about you.

## Data retention and deletion

Your account, expenses, people, groups, payments, receipts, and UPI ID live only on your device. To delete them:

- Long-press an expense in **Expenses** and choose **Delete** to remove it, or
- Open an expense and use **Delete**, or **Remove** on an attached receipt, or
- Open **Payment details** and choose **Remove UPI ID**, or
- Uninstall VaatUp, or clear the app's storage in Android Settings → Apps → VaatUp → Storage → Clear data.

Because nothing is stored off-device, uninstalling the app removes all of it permanently. There is no copy to request or erase.

## Children

VaatUp is a general-purpose utility and is not directed at children.

## Changes

If this policy changes, the updated version will be published at the same URL with a new date at the top.

## Contact

Questions about this policy: **<your-support-email>**

---

> **Before publishing:** replace `<your-support-email>` with a real address and host this page at a public URL (GitHub Pages, a Gist, or your own site), then paste that URL into the Play Console privacy policy field.
