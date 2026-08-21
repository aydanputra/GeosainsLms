const { execSync } = require('child_process');

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: npm run deploy -- <tag>');
  console.error('Example: npm run deploy -- v1.0.0');
  process.exit(1);
}

const sshKey = 'C:\\Users\\Ayazzafan\\.ssh\\geosains_adminvps';
const cmd = `ssh -i "${sshKey}" root@geosains.id "bash /srv/geosains/app/scripts/deploy.sh ${tag}"`;

console.log(`Deploying ${tag} to production...`);
execSync(cmd, { stdio: 'inherit' });