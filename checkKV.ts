import { supabase } from './src/app/utils/supabase';

async function checkKV() {
  const { data, error } = await supabase.from('kv_store').select('*').limit(1);
  console.log('Select:', data, error);
}
checkKV();