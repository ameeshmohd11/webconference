#!/usr/bin/env node

/**
 * NEXUS Deployment Helper
 * Run: node deploy-helper.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const platforms = {
  1: 'heroku',
  2: 'railway',
  3: 'render',
  4: 'aws',
  5: 'digitalocean'
};

const instructions = {
  heroku: `
📦 HEROKU DEPLOYMENT

1. Install Heroku CLI
   npm install -g heroku

2. Login
   heroku login

3. Create app
   heroku create your-app-name

4. Set environment variables
   heroku config:set NODE_ENV=production
   heroku config:set CORS_ORIGINS=https://your-app-name.herokuapp.com

5. Deploy
   git push heroku main

6. View logs
   heroku logs --tail

Docs: https://devcenter.heroku.com/articles/deploying-nodejs
  `,
  
  railway: `
📦 RAILWAY DEPLOYMENT

1. Go to https://railway.app

2. Click "New Project"

3. Select "Deploy from GitHub"

4. Connect your repository

5. Add environment variables in dashboard:
   NODE_ENV=production
   CORS_ORIGINS=https://your-project.up.railway.app

6. Railway auto-deploys on push!

Docs: https://docs.railway.app
  `,
  
  render: `
📦 RENDER DEPLOYMENT

1. Go to https://render.com

2. Create New > Web Service

3. Connect GitHub repository

4. Configure:
   Runtime: Node
   Build Command: npm install
   Start Command: npm start

5. Add environment variables:
   NODE_ENV=production
   CORS_ORIGINS=https://yourapp.onrender.com

6. Deploy!

Docs: https://render.com/docs
  `,
  
  aws: `
📦 AWS EC2 DEPLOYMENT

1. Launch EC2 instance (Ubuntu 22.04)

2. SSH in
   ssh -i your-key.pem ec2-user@your-ip

3. Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

4. Clone repository
   git clone https://github.com/your/repo.git
   cd Video\\ Conferrencing\\ app

5. Install and run
   npm install
   npm start

6. Setup PM2 for auto-restart
   npm install -g pm2
   pm2 start server.js --name "nexus"
   pm2 startup
   pm2 save

7. Setup Nginx reverse proxy (see DEPLOYMENT.md)

8. Setup SSL with Let's Encrypt
   sudo apt install certbot
   sudo certbot certonly --standalone -d yourdomain.com

Docs: https://docs.aws.amazon.com/ec2
  `,
  
  digitalocean: `
📦 DIGITALOCEAN DEPLOYMENT

1. Create Droplet
   - OS: Ubuntu 22.04
   - Size: $5/month
   - Add SSH key

2. SSH in
   ssh root@your_droplet_ip

3. Install Node.js
   apt update
   apt install nodejs npm

4. Clone and deploy (same as AWS EC2)

5. Setup Nginx and SSL (see DEPLOYMENT.md)

Docs: https://www.digitalocean.com/docs
  `
};

console.log('\n🚀 NEXUS Deployment Helper\n');
console.log('Select your deployment platform:\n');
console.log('1. Heroku (easiest, but paid)');
console.log('2. Railway (recommended for beginners)');
console.log('3. Render (simple, affordable)');
console.log('4. AWS EC2 (most control)');
console.log('5. DigitalOcean (VPS, simple)\n');

rl.question('Enter number (1-5): ', (answer) => {
  const platform = platforms[answer];
  
  if (!platform) {
    console.log('\n❌ Invalid choice');
    rl.close();
    process.exit(1);
  }
  
  console.log('\n' + instructions[platform]);
  
  rl.question('\nWould you like to create .env for production? (y/n): ', (env_answer) => {
    if (env_answer.toLowerCase() === 'y') {
      createEnvFile();
    }
    rl.close();
  });
});

function createEnvFile() {
  const envContent = `# NEXUS Production Configuration
NODE_ENV=production
PORT=3000

# Update these for your domain
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Optional: Add TURN server for better connectivity
# TURN_SERVER=turn:your-turn-server.com:3478
# TURN_USERNAME=your_username
# TURN_PASSWORD=your_password
`;

  const envPath = path.join(__dirname, '.env.production');
  fs.writeFileSync(envPath, envContent);
  console.log(`\n✅ Created .env.production`);
}
