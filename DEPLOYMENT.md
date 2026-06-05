# NEXUS Deployment Guide

Complete instructions for deploying the video conferencing backend to production.

## Prerequisites

- Server deployed with Node.js support
- Domain name (optional but recommended)
- SSL/TLS certificate (required for WebRTC in production)
- Registered account on your chosen platform

---

## Option 1: Heroku (Easiest)

### Setup

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Initialize Git** (if not done)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **View logs**
   ```bash
   heroku logs --tail
   ```

6. **Access your app**
   ```
   https://your-app-name.herokuapp.com
   ```

### Configuration

Create `Procfile` in project root:
```
web: node server.js
```

Update `server.js` for production:
```javascript
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';
```

**Cost**: Free tier available (limited), then $5-50/month

---

## Option 2: Railway.app (Recommended for beginners)

### Setup

1. **Connect GitHub**
   - Push code to GitHub
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository

2. **Auto-deploy**
   - Railway automatically detects Node.js
   - Deploys on every GitHub push

3. **Get your URL**
   - Check Railway dashboard
   - Your app will be at `your-project.up.railway.app`

### Configuration

Add environment variables in Railway dashboard:
```
NODE_ENV=production
PORT=3000
```

**Cost**: $5 credit free, then pay-as-you-go (~$5-10/month for small projects)

---

## Option 3: Render.com

### Setup

1. **Create account** at https://render.com

2. **Create new Web Service**
   - Connect GitHub repo
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`

3. **Deploy**
   - Auto-deploys on GitHub push
   - Get free domain: `yourapp.onrender.com`

**Cost**: Free tier available, $7/month for paid

---

## Option 4: AWS (Most Control)

### Using EC2

1. **Launch EC2 instance**
   - AMI: Ubuntu 22.04 LTS
   - Instance: t3.micro (free tier eligible)
   - Security group: Allow ports 80, 443, 3000

2. **SSH into instance**
   ```bash
   ssh -i your-key.pem ec2-user@your-ip
   ```

3. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Clone and run**
   ```bash
   git clone https://github.com/your/repo.git
   cd Video\ Conferrencing\ app
   npm install
   npm start
   ```

5. **Use PM2 for auto-restart**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "nexus"
   pm2 startup
   pm2 save
   ```

6. **Setup reverse proxy with Nginx**
   ```bash
   sudo apt install nginx
   ```
   
   Create `/etc/nginx/sites-available/nexus`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
   
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Enable and start:
   ```bash
   sudo ln -s /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```

7. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

**Cost**: $3-10/month for t3.micro + data transfer

---

## Option 5: DigitalOcean (VPS)

### Setup

1. **Create Droplet**
   - OS: Ubuntu 22.04
   - Size: $5/month (1GB RAM)
   - Get SSH key

2. **Connect and deploy** (same as AWS EC2 above)

**Cost**: $5/month minimum

---

## Production Configuration

Update `server.js` for production deployment:

```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// CORS for production
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'https://yourdomain.com',
  'https://www.yourdomain.com'
];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rest of server code...
```

Update `.env` for production:

```env
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

---

## SSL/HTTPS Setup

### For Heroku/Railway/Render
- ✅ Automatic (included with custom domain)

### For Self-Hosted (EC2/DigitalOcean)

**Option A: Let's Encrypt (Free)**
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

**Option B: AWS Certificate Manager**
- Free SSL certificates
- Auto-renewal

---

## TURN Server Setup (For NAT Traversal)

For production deployments across different networks, deploy a TURN server:

### Option 1: Coturn (Self-hosted)
```bash
sudo apt install coturn
```

Edit `/etc/coturn/turnserver.conf`:
```
server-name=yourserver.com
realm=yourserver.com
listening-ip=0.0.0.0
listening-port=3478
listening-ip=::
listening-port=3478
```

### Option 2: Managed TURN (Recommended)
- **Twilio**: $0.02/GB
- **XirSys**: $0.01-0.05/GB
- **Metered.ca**: Free tier available

Update `server.js`:
```javascript
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password'
    }
  ]
};
```

---

## Environment Variables (Production)

Create `.env.production`:
```env
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://yourdomain.com
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVER=turn:your-turn-server.com:3478
TURN_USERNAME=username
TURN_PASSWORD=password
LOG_LEVEL=info
MAX_ROOMS=1000
ROOM_TIMEOUT=300000
```

---

## Monitoring & Logging

### PM2 Monitoring (Self-hosted)
```bash
pm2 start server.js --name "nexus" --log-date-format "YYYY-MM-DD HH:mm:ss Z"
pm2 logs nexus
pm2 monit
```

### Application Performance Monitoring
- **New Relic**: Free tier
- **DataDog**: Enterprise
- **Sentry**: Error tracking (free tier)

Example Sentry integration:
```bash
npm install @sentry/node
```

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

---

## Database (Optional)

For storing call history, user data:

```bash
npm install mongoose dotenv
```

Example MongoDB connection:
```javascript
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

const callSchema = new mongoose.Schema({
  roomId: String,
  host: String,
  guest: String,
  duration: Number,
  startTime: Date,
  endTime: Date
});

const Call = mongoose.model('Call', callSchema);
```

---

## Security Checklist

- [ ] SSL/HTTPS enabled
- [ ] CORS configured for your domain only
- [ ] Rate limiting enabled
- [ ] Input validation on server
- [ ] Security headers set
- [ ] MongoDB/DB credentials in `.env`
- [ ] No sensitive data in logs
- [ ] Firewall blocking unused ports
- [ ] Regular security updates (dependencies)
- [ ] API key rotation enabled

---

## Performance Tips

1. **Enable gzip compression**
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

2. **Use Redis for session storage**
   ```bash
   npm install redis
   ```

3. **Load balancing** (for high traffic)
   - Use HAProxy or Nginx upstream
   - Scale horizontally with multiple server instances

4. **CDN for static files**
   - CloudFlare (free tier)
   - AWS CloudFront
   - Akamai

5. **Database indexing**
   - Index frequently queried fields
   - Regular query optimization

---

## Cost Comparison

| Platform | Cost | Best For |
|----------|------|----------|
| Heroku | $7-50/mo | Quick prototyping |
| Railway | $5-20/mo | Hobby projects |
| Render | $7-25/mo | Small apps |
| DigitalOcean | $5-50/mo | Full control |
| AWS | $5-100+/mo | Enterprise |
| Linode | $5-50/mo | Balance |

---

## Quick Deploy Steps

### Heroku (5 min)
```bash
heroku create your-app
git push heroku main
```

### Railway (3 min)
1. Connect GitHub
2. Click "Deploy"
3. Done!

### DigitalOcean (30 min)
1. Create $5 droplet
2. SSH in, install Node
3. Clone repo, run `npm start`

---

## Troubleshooting

### "WebRTC not working after deployment"
- Check CORS settings match your domain
- Verify STUN/TURN servers accessible
- Enable SSL (required for WebRTC in production)

### "High latency/dropped connections"
- Deploy closer to users (multi-region)
- Add TURN server
- Increase server resources

### "Memory leaks"
- Check for unclosed connections
- Use PM2 auto-restart
- Monitor with `pm2 monit`

---

## Next Steps

1. Choose platform above
2. Create `.env.production`
3. Update CORS origins
4. Deploy!
5. Test at your domain
6. Monitor performance
7. Setup alerts

**Need help?** Check platform-specific docs or open an issue.
