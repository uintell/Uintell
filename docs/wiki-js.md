# Wiki.js Deployment

Wiki.js should run on a dedicated hostname. The official install guidance states that it cannot be mapped to a subfolder, so use `wiki.uintell.org` instead of `/wiki`.

## Install

```bash
bash /home/x1/projectx/infra/scripts/install-wikijs.sh
```

Then edit `/home/x1/projectx/var/wiki-js/current/config.yml` and set the Postgres password for the `wikijs` user before starting the service.

## Systemd

Install the unit and enable it:

```bash
sudo cp /home/x1/projectx/infra/systemd/wiki-js.service /etc/systemd/system/wiki-js.service
sudo systemctl daemon-reload
sudo systemctl enable --now wiki-js.service
```

## Nginx

Install the nginx vhost:

```bash
sudo cp /home/x1/projectx/infra/nginx/wiki.uintell.org.conf /etc/nginx/conf.d/wiki.uintell.org.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Cloudflare Tunnel

Add this ingress rule before the final `http_status:404` entry in `/home/x1/.cloudflared/config.yml`:

```yaml
- hostname: wiki.uintell.org
  service: http://localhost:80
```

You must also create a DNS record in Cloudflare for `wiki.uintell.org` that targets the existing tunnel.
