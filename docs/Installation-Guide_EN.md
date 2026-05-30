# Abu Installation Guide

**English** | [中文](Installation-Guide.md)

## Download

Head to [GitHub Releases](https://github.com/wismyzhizi2018/Abu-Cowork/releases) to download the installer for your platform:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `Abu_x.x.x_aarch64.dmg` |
| macOS (Intel) | `Abu_x.x.x_x64.dmg` |
| Windows | `Abu_x.x.x_x64-setup.exe` |

---

## macOS Installation

### 1. Install the App

Double-click the `.dmg` file and drag Abu into the `Applications` folder.

### 2. Fix "App is Damaged" Warning

Since Abu is not yet signed with an Apple Developer certificate, macOS will show this warning on first launch:

> "Abu" is damaged and can't be opened. You should move it to the Trash.

**Solution:**

Open **Terminal** (search "Terminal" in Launchpad) and run:

```bash
xattr -cr /Applications/Abu.app
```

Press Enter, then double-click Abu to open it.

> **Tip**: If you installed Abu in a different location, replace `/Applications/Abu.app` with the actual path. You can also type `xattr -cr ` and drag the Abu.app icon into the Terminal window — the path will auto-fill.

### 3. Alternative Method

If the command above doesn't work, try:

```bash
sudo spctl --master-disable
```

This temporarily disables Gatekeeper. After installation, re-enable it:

```bash
sudo spctl --master-enable
```

---

## Windows Installation

### 1. Install the App

Double-click the `.exe` installer and follow the prompts.

### 2. Handle SmartScreen Warning

Since Abu is not yet code-signed, Windows SmartScreen may show:

> Windows protected your PC — prevented an unrecognized app from starting.

**Solution:**

1. Click **"More info"** in the popup
2. Click **"Run anyway"**

The app will launch normally.

### Alternative: Unblock via Properties

If the installer won't run after downloading:

1. Right-click the `.exe` file → select **"Properties"**
2. At the bottom, find the **"Security"** section and check **"Unblock"**
3. Click **"OK"**, then double-click to install

---

## FAQ

### Q: Is this safe?

Abu is open-source software — you can review the full source code on GitHub. The security warnings appear because the app hasn't been signed with a commercial code-signing certificate, not because there's anything wrong with the app itself.

### Q: Do I need to do this after every update?

- **macOS**: Yes, you'll need to run `xattr -cr` again after each update.
- **Windows**: Usually only the first launch requires SmartScreen approval.

### Q: Will this be fixed in the future?

We plan to purchase code-signing certificates (Apple Developer + Windows EV certificate) for the official release, which will eliminate these security prompts.
