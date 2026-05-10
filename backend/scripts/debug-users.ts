import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

async function debug() {
  console.log('--- SUPABASE AUTH USERS ---');
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) console.error(authError);
  else users.forEach(u => console.log(`- ${u.email} (ID: ${u.id})`));

  console.log('\n--- PUBLIC.USERS TABLE ---');
  const { data: publicUsers, error: dbError } = await supabase.from('users').select('email, username, full_name, role');
  if (dbError) console.error(dbError);
  else publicUsers?.forEach(u => console.log(`- Email: ${u.email}, Username: ${u.username}, Role: ${u.role}`));
}

debug().catch(console.error);
