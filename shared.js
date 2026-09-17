const SUPABASE_URL = 'https://rvdxrsvptrxvgimfpiui.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZHhyc3ZwdHJ4dmdpbWZwaXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTQwNDUsImV4cCI6MjEwNDY3MDA0NX0.6CY97KVkuWqF5Lq-fTa-jioq0o_bdVIzFqMYv5DVRw0;'
const AUTH_FN_URL = `${SUPABASE_URL}/functions/v1/public-auth`;
const ADMIN_FN_URL = `${SUPABASE_URL}/functions/v1/admin-actions`;

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const AVATAR_COLORS = ['#2C3E63', '#3F6B4E', '#D98E2B', '#A6432B'];
const KNOWN_AREAS = [
  'Anantpur', 'Chirahula Colony', 'Padra', 'Huzur', 'Saman', 'Chorhata',
  'Indira Nagar', 'Maidani', 'Sirmour Chowk', 'Civil Lines'
];

function initials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function colorFor(id) {
  let h = 0;
  const str = String(id || '');
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function starString(n) {
  const full = Math.round(n || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function waLink(phone, name, context) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '#';
  const withCountry = digits.length === 10 ? '91' + digits : digits;
  const msg = encodeURIComponent(`Hello ${name}, this is regarding ${context} on Shiksha Kiran.`);
  return `https://wa.me/${withCountry}?text=${msg}`;
}

// Data mappers
function mapTutor(r) {
  return { id: r.id, name: r.name, subject: r.subject, levels: r.levels, qual: r.qual, exp: r.exp, area: r.area, price: r.price, phone: r.phone, status: r.status, createdAt: new Date(r.created_at).getTime() };
}
function mapApplication(r) {
  return { id: r.id, tutorId: r.tutor_id, tutorName: r.tutor_name, parentName: r.parent_name, parentPhone: r.parent_phone, childName: r.child_name, createdAt: new Date(r.created_at).getTime() };
}
function mapRequirement(r) {
  return { id: r.id, name: r.name, phone: r.phone, subject: r.subject, levels: r.levels, area: r.area, budget: r.budget, notes: r.notes, createdAt: new Date(r.created_at).getTime() };
}
function mapAttendance(r) {
  return { id: r.id, applicationId: r.application_id, date: r.date, time: r.time, present: r.present, createdAt: new Date(r.created_at).getTime() };
}
function mapReview(r) {
  return { id: r.id, type: r.type, applicationId: r.application_id, tutorId: r.tutor_id, parentName: r.parent_name, rating: r.rating, comment: r.comment, note: r.note, createdAt: new Date(r.created_at).getTime() };
}
function mapParentAccount(r) {
  return { phone: r.phone, name: r.name, createdAt: new Date(r.created_at).getTime() };
}

async function callAuth(action, phone, password) {
  let res;
  try {
    res = await fetch(AUTH_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, phone, password })
    });
  } catch (e) {
    throw new Error('Could not reach the server. Check your internet connection and try again.');
  }
  let json;
  try { json = await res.json(); }
  catch (e) { throw new Error(`Server responded with status ${res.status} but sent back no readable message.`); }
  if (!res.ok) throw new Error(json.error || `Request failed (status ${res.status}).`);
  return json.data;
}

async function callAdmin(adminPassword, action, payload) {
  let res;
  try {
    res = await fetch(ADMIN_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, action, payload })
    });
  } catch (e) {
    throw new Error('Could not reach the server. Check your internet connection and try again.');
  }
  let json;
  try { json = await res.json(); }
  catch (e) { throw new Error(`Server responded with status ${res.status} but sent back no readable message.`); }
  if (!res.ok) throw new Error(json.error || `Request failed (status ${res.status}).`);
  return json.data;
}
