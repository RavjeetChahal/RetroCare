# Running RetroCare on Local Network (Multiple Devices)

## The Problem

When you run the app on `localhost`, each device only sees its own `localhost`. If you run the backend on your machine, your friend's device can't access it via `localhost:3000` because that points to their own device, not yours.

## Solution: Use Your Machine's Local IP Address

### Step 1: Find Your Machine's Local IP Address

**On macOS/Linux:**
```bash
# Terminal command to find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or simpler:
ipconfig getifaddr en0
# (macOS - try en0, en1, or en2 if en0 doesn't work)
```

**On Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

You'll get something like: `192.168.1.100` or `10.0.0.5`

### Step 2: Update Your `.env` File

Change `EXPO_PUBLIC_API_URL` to use your IP address instead of `localhost`:

**Your `.env` file:**
```env
# Replace localhost with your actual IP address
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
# (Use your actual IP from Step 1)
```

### Step 3: Update Clerk Allowed Origins

Clerk needs to allow requests from both devices:

1. Go to https://dashboard.clerk.com/
2. Select your application
3. Go to **Settings** → **Allowed Origins** (or **Redirect URLs**)
4. Add both:
   - `http://localhost:8081` (for your device)
   - `http://YOUR_IP:8081` (for your friend's device, e.g., `http://192.168.1.100:8081`)
   - `http://localhost:3000` (backend)
   - `http://YOUR_IP:3000` (backend on network)

### Step 4: Start the Backend

Make sure your backend is running and accessible on your network:

```bash
npm run backend
```

The backend should bind to `0.0.0.0:3000` (all interfaces) so it's accessible on your local network. If it's only binding to `127.0.0.1`, you may need to update `backend/server.ts`.

### Step 5: Start Expo

Start Expo as usual:

```bash
npm start
```

**On your device:**
- Use `localhost` URL as normal
- Or scan the QR code

**On your friend's device:**
- Use the **tunnel URL** or **LAN URL** shown by Expo
- Or manually enter: `exp://YOUR_IP:8081`
- Make sure both devices are on the same Wi-Fi network

### Step 6: Share the App URL

When Expo starts, it shows multiple URLs:
- **Metro waiting on `exp://192.168.1.100:8081`** ← This is what your friend uses
- **Metro waiting on `exp://localhost:8081`** ← This is for your device

Your friend can:
1. Scan the QR code (if on the same network)
2. Or manually enter `exp://192.168.1.100:8081` in Expo Go

## Alternative: Use Expo Tunnel

If you're on different networks, use Expo's tunnel:

```bash
npm start -- --tunnel
```

This creates a public URL that works from anywhere, but it's slower.

## Troubleshooting

### "Connection refused" or "Failed to fetch"
- ✅ Make sure your backend is running on `0.0.0.0:3000` (not just `127.0.0.1:3000`)
- ✅ Check your firewall isn't blocking port 3000
- ✅ Verify both devices are on the same Wi-Fi network
- ✅ Double-check the IP address in `EXPO_PUBLIC_API_URL`

### "Clerk authentication failed"
- ✅ Add both devices' URLs to Clerk's Allowed Origins
- ✅ Make sure you're using production Clerk keys if testing across devices

### Backend only accessible on localhost

Check your `backend/server.ts` - the `app.listen()` should be:

```typescript
app.listen(PORT, '0.0.0.0', () => {
  // This makes it accessible on all network interfaces
  logger.info(`Server running on port ${PORT}`);
});
```

If it's `app.listen(PORT, () => ...)`, it defaults to `0.0.0.0`, which is fine.

## Quick Checklist

- [ ] Found your machine's local IP address
- [ ] Updated `.env` with `EXPO_PUBLIC_API_URL=http://YOUR_IP:3000`
- [ ] Added both devices to Clerk's Allowed Origins
- [ ] Backend is running and accessible
- [ ] Both devices on same Wi-Fi network
- [ ] Friend is using the LAN/tunnel URL, not localhost

## Example Setup

**Your machine IP:** `192.168.1.100`

**Your `.env`:**
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

**Clerk Allowed Origins:**
- `http://localhost:8081`
- `http://192.168.1.100:8081`
- `http://localhost:3000`
- `http://192.168.1.100:3000`

**Friend's device:** Opens `exp://192.168.1.100:8081` in Expo Go

Now both of you can use the app! 🎉

