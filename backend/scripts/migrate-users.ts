import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrateUsers() {
  console.log('--- Starting Migration ---');

  // Fetch all existing users from your public.users table
  // Using 'full_name' instead of 'name' based on existing schema
  const { data: existingUsers, error } = await supabase
    .from('users')
    .select('id, email, full_name, role');

  if (error) {
    console.error('Failed to fetch users:', error.message);
    return;
  }

  if (!existingUsers || existingUsers.length === 0) {
    console.log('No users found in public.users table.');
    return;
  }

  console.log(`Found ${existingUsers.length} users to migrate.`);

  for (const user of existingUsers) {
    if (!user.email) {
      console.warn(`Skipping user with ID ${user.id} (missing email).`);
      continue;
    }

    console.log(`Migrating: ${user.email} (${user.full_name})`);

    try {
      // Create the user in Supabase Auth
      const { data: authData, error: createError } =
        await supabase.auth.admin.createUser({
          email: user.email,
          password: `TempPass_${Math.random().toString(36).slice(2)}!`, // Temporary password
          email_confirm: true, // Skip email confirmation for migration
          user_metadata: {
            name: user.full_name,
            role: user.role,
            public_user_id: user.id,
          },
        });

      if (createError) {
        if (createError.message.includes('already been registered')) {
          console.log(`  - ${user.email} already exists in Supabase Auth. Attempting to link...`);
          // Try to find the existing auth user to link them anyway
          const { data: listUsers, error: listError } = await supabase.auth.admin.listUsers();
          if (!listError) {
             const existingAuthUser = listUsers.users.find(u => u.email === user.email);
             if (existingAuthUser) {
                await linkUser(user.id, existingAuthUser.id, user.email);
             }
          }
        } else {
          console.error(`  - Failed to migrate ${user.email}:`, createError.message);
        }
        continue;
      }

      const authUser = authData.user;
      console.log(`  ✓ Auth user created: ${authUser.id}`);

      // Link the auth user back to your public.users table
      await linkUser(user.id, authUser.id, user.email);

      // Send password recovery email
      const { error: recoveryError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
      });

      if (recoveryError) {
        console.warn(`  ! Could not send recovery email for ${user.email}:`, recoveryError.message);
      } else {
        console.log(`  ✓ Recovery email triggered for ${user.email}`);
      }

    } catch (err) {
      console.error(`  - Unexpected error migrating ${user.email}:`, err);
    }
  }

  console.log('--- Migration Finished ---');
}

async function linkUser(publicId: string, authId: string, email: string) {
  const { error: updateError } = await supabase
    .from('users')
    .update({ auth_id: authId })
    .eq('id', publicId);

  if (updateError) {
    if (updateError.message.includes('column "auth_id" of relation "users" does not exist')) {
      console.error(`  ! Column "auth_id" does not exist in "users" table. Please add it via SQL: ALTER TABLE public.users ADD COLUMN auth_id UUID UNIQUE;`);
    } else {
      console.error(`  ! Failed to link ${email}:`, updateError.message);
    }
  } else {
    console.log(`  ✓ Linked public.users ID ${publicId} to auth_id ${authId}`);
  }
}

migrateUsers().catch(console.error);
