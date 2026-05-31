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

const content = `export const environment = {
  production: true,
  supabaseUrl: '${supabaseUrl}',
  supabaseKey: '${supabaseKey}',
};
`;

writeFileSync(join(envDir, 'environment.prod.ts'), content);
console.log('environment.prod.ts generated successfully.');
