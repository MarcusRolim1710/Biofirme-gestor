const SUPABASE_URL = 'https://vbqxgvyfcgfdlkdjclce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicXhndnlmY2dmZGxrZGpjbGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MzA1NDUsImV4cCI6MjEwMzQwNjU0NX0.nCW3-4UoV0fmuWs3tJgL9g7rAWDbUBnOf16MM7ITMr0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
  },
});

async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, username, role')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw new Error('Perfil não encontrado para este usuário.');

  return { user: profile, session: data.session };
}

async function logout() {
  await supabaseClient.auth.signOut();
  sessionStorage.removeItem('biofirm_user');
}

async function getCurrentProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('id, username, role')
    .eq('id', user.id)
    .single();
  return profile;
}
