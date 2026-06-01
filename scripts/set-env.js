const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const envDir = join(__dirname, '../src/environments');
mkdirSync(envDir, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_KEY environment variables are required.');
  process.exit(1);
}

const prodContent = `export const environment = {
  production: true,
  supabaseUrl: '${supabaseUrl}',
  supabaseKey: '${supabaseKey}',
};
`;

const devContent = `export const environment = {
  production: false,
  supabaseUrl: '${supabaseUrl}',
  supabaseKey: '${supabaseKey}',
};
`;

writeFileSync(join(envDir, 'environment.prod.ts'), prodContent);
writeFileSync(join(envDir, 'environment.ts'), devContent);
console.log('environment.prod.ts generated successfully.');
console.log('environment.ts generated successfully.');
