import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fialncxvjjptzacoyhzs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpYWxuY3h2ampwdHphY295aHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5Mzc0NDYsImV4cCI6MjA3MDUxMzQ0Nn0.RfMt4zPfsLC9Rad-tsbAo1ipGFHJNn7MSsKVlcjjIaI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);