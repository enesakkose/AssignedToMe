# Privacy Policy

**AssignedToMe** · Last updated: 2026-11-25

AssignedToMe is built to keep your data on your device. It has no account system, no backend server of ours, and no analytics or tracking.

## What the app stores, and where

- **API keys and tokens** for the task sources you connect (Jira, Linear, GitHub, GitLab and others) are stored only in your device's secure storage — the iOS Keychain (via SecureStore) on iPhone, the Android Keystore on Android. They are never sent to us or to any third party other than the source they belong to.
- **Your task data** (titles, statuses, assignees, and similar fields) is fetched directly from the sources you connect and cached locally on your device so the app opens quickly. It is not uploaded anywhere else.

## Who your data is shared with

- **No one, except the sources you choose.** The app talks only to the APIs of the task sources you connect, using the credentials you provide, to read and update your work. It sends your credentials to no other host.
- We do **not** collect, receive, store, sell, or share any of your personal data. We cannot see your tasks, your credentials, or your usage.
- There is **no analytics or advertising SDK** in the app.

## Moving boards between your own devices

If you transfer a connected board from one of your devices to another, the data is **end-to-end encrypted** with a one-time code shown on the receiving device, and the transfer is peer-to-peer. The code is never shown on the sending device, and keys are never transferred unencrypted.

## Permissions

- **Camera** is used only if you choose to scan a transfer QR code; images are processed on-device and not stored or sent.
- **Notifications** are used only to alert you about newly assigned tasks, generated on your device.

## Data deletion

Because nothing is stored on our side, removing a connected source in Settings, or deleting the app, removes the related data from your device. There is nothing for us to delete on a server, because we never had it.

## Contact

Questions or requests: open an issue at https://github.com/enesakkose/AssignedToMe/issues
