/**
 * Run database migration
 * 
 * Executes the migration SQL file to create necessary tables for anomaly detection
 * 
 * Run with: npx tsx scripts/runMigration.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { getSupabaseClient } from '../backend/supabase/client';
import { logger } from '../backend/utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

async function runMigration() {
  try {
    console.log('🔄 Running database migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../backend/supabase/migrations/001_add_new_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📝 SQL length:', migrationSQL.length, 'characters\n');
    
    // Split SQL into individual statements (semicolon-separated)
    // Remove comments and empty lines
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';'); // Add semicolon back
    
    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
    
    const supabase = getSupabaseClient();
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 100).replace(/\n/g, ' ');
      
      try {
        console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
        
        // Use RPC to execute raw SQL (if available) or use direct query
        // Note: Supabase JS client doesn't support raw SQL execution directly
        // We'll need to use the REST API or Supabase dashboard
        
        // For now, we'll use a workaround: execute via REST API
        const response = await fetch(
          `${process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
            },
            body: JSON.stringify({ sql: statement }),
          }
        );
        
        if (!response.ok) {
          // Try direct execution via Supabase client
          // Since we can't execute raw SQL directly, we'll provide instructions
          throw new Error('Direct SQL execution not available via JS client');
        }
        
        successCount++;
        console.log(`✅ Success\n`);
      } catch (error: any) {
        // If RPC doesn't exist, we'll provide manual instructions
        if (error.message.includes('exec_sql') || error.message.includes('not available')) {
          console.log('⚠️  Cannot execute raw SQL via JS client\n');
          console.log('📋 Please run this migration manually in Supabase Dashboard:\n');
          console.log('1. Go to your Supabase project dashboard');
          console.log('2. Navigate to SQL Editor');
          console.log('3. Copy and paste the contents of:');
          console.log(`   ${migrationPath}`);
          console.log('4. Click "Run" to execute\n');
          
          // Show the SQL for easy copying
          console.log('='.repeat(60));
          console.log('MIGRATION SQL (copy this):');
          console.log('='.repeat(60));
          console.log(migrationSQL);
          console.log('='.repeat(60));
          
          process.exit(0);
        }
        
        errorCount++;
        console.log(`❌ Error: ${error.message}\n`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📝 Total: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Some statements failed. Check errors above.');
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

