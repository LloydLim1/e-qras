import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

async function setPassword(email: string, passwordStr: string) {
  console.log(`Setting password for ${email}...`);

  // 1. Find user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError.message);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`User with email ${email} not found in Supabase Auth.`);
    return;
  }

  // 2. Update password
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: passwordStr }
  );

  if (updateError) {
    console.error('Failed to update password:', updateError.message);
  } else {
    console.log(`✓ Password successfully updated for ${email}`);
  }
}

const targetEmail = 'admin01@gmail.com';
const targetPassword = 'admin123';

setPassword(targetEmail, targetPassword).catch(console.error);
