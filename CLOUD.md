# Cloud Access & Security Setup for FamilySync

To securely access your FamilySync portal from anywhere without opening ports on your home router, follow these steps using Cloudflare Tunnels (matching your frosty setup!).

## 1. Install Cloudflared
On your Linux Docker Server (`102.168.100.19`), install the Cloudflare Tunnel agent:

```bash
# Example for Debian/Ubuntu (on 102.168.100.19)
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
cloudflared tunnel create familysync-tunnel
```
This will create your secure tunnel and download a credentials JSON file.

## 4. Configure the Tunnel
Create or edit your config file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: familysync.yourdomain.com
    service: http://localhost:5000
  - service: http_status:404
```

*Note: Make sure your host port in `docker-compose.yml` matches `5000` (e.g., `"5000:5000"`).*

## 5. Route Traffic
Route your subdomain to your new tunnel:
```bash
cloudflared tunnel route dns familysync-tunnel familysync.yourdomain.com
```

## 6. Run the Tunnel
To start the tunnel immediately:
```bash
cloudflared tunnel run familysync-tunnel
```

To run it continuously as a system service:
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 7. Cloudflare Zero Trust Security (Highly Recommended)
Since FamilySync is private to your home, protect the entry point at your **Cloudflare Zero Trust** dashboard:
1. Navigate to **Access** -> **Applications**.
2. Click **Add an Application** -> **Self-hosted**.
3. Set the domain to `familysync.yourdomain.com`.
4. Configure an access policy:
   - Create a rule to allow only specified email addresses (via One-Time PIN) or associate your Google/GitHub SSO.
   - This adds a bulletproof authentication layer *before* anyone even reaches the login page of FamilySync!
