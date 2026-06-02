# Cloud Access & Security Setup for FamilyHub

To securely access your FamilyHub portal from anywhere without opening ports on your home router, follow these steps using Cloudflare Tunnels (matching your frosty setup!).

## 1. Install Cloudflared
On your Linux Docker Server (`192.168.100.19`), install the Cloudflare Tunnel agent:

```bash
# Example for Debian/Ubuntu (on 192.168.100.19)
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

## 2. Authenticate
```bash
cloudflared tunnel login
```
Follow the link provided in your terminal to authorize your Cloudflare account.

## 3. Create a Tunnel
```bash
cloudflared tunnel create familyhub-tunnel
```
This will create your secure tunnel and download a credentials JSON file.

## 4. Configure the Tunnel
Create or edit your config file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: familyhub.yourdomain.com
    service: http://localhost:5000
  - service: http_status:404
```

*Note: Make sure your host port in `docker-compose.yml` matches `5000` (e.g., `"5000:5000"`).*

## 5. Route Traffic
Route your subdomain to your new tunnel:
```bash
cloudflared tunnel route dns familyhub-tunnel familyhub.yourdomain.com
```

## 6. Run the Tunnel
To start the tunnel immediately:
```bash
cloudflared tunnel run familyhub-tunnel
```

To run it continuously as a system service:
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 7. Cloudflare Zero Trust Security (Highly Recommended)
Since FamilyHub is private to your home, protect the entry point at your **Cloudflare Zero Trust** dashboard:
1. Navigate to **Access** -> **Applications**.
2. Click **Add an Application** -> **Self-hosted**.
3. Set the domain to `familyhub.yourdomain.com`.
4. Configure an access policy:
   - Create a rule to allow only specified email addresses (via One-Time PIN) or associate your Google/GitHub SSO.
   - This adds a bulletproof authentication layer *before* anyone even reaches the login page of FamilyHub!

## 🔒 8. Secure Context & HTTPS Requirement
FamilyHub uses the browser's native **Web Crypto API (subtle)** to execute its end-to-end encryption (E2EE). Modern browsers strictly limit these cryptographic primitives to **Secure Contexts** (localhost loopbacks or domains with active HTTPS/SSL).

Accessing FamilyHub over standard `http://YOUR_SERVER_IP:5000` from other devices on your LAN will disable the browser's Web Crypto APIs, blocking E2EE capabilities for privacy preservation.

By routing your traffic through a **Cloudflare Tunnel**, Cloudflare automatically issues and manages free edge SSL certificates, delivering robust, zero-configuration HTTPS (`https://familyhub.yourdomain.com`). This fulfills the secure context validation perfectly, enabling full-strength, hardware-accelerated AES-GCM 256-bit cryptography on all family devices and wall tablets safely!
