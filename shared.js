// =====================================================================
// Shiksha Kiran: shared browser code
// Supabase project: ftcrbygzevldpejydglc
// =====================================================================

const SUPABASE_URL = 'https://ftcrbygzevldpejydglc.supabase.co';
// Publishable key: safe to keep in the browser. NEVER put the service_role key here.
// If a request ever says "Invalid API key", use the legacy anon key from
// Supabase > Project Settings > API Keys instead.
const SUPABASE_KEY = 'sb_publishable_vh-Bu0f43fKuFW_gheQCCw_1972GsTq';
const AUTH_FN_URL = `${SUPABASE_URL}/functions/v1/public-auth`;
const ADMIN_FN_URL = `${SUPABASE_URL}/functions/v1/admin-actions`;

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------
// IMPORTANT RULE FOR EVERY PAGE THAT USES THIS FILE
// The `password` column of `tutors` and `parent_accounts` is blocked from
// reading, on purpose. So NEVER write:
//    .select('*')   .select()   ?select=*   or   .insert(...).select()
// on those two tables. Use the column lists below, or the helper functions
// (fetchTutors, fetchParentAccounts, registerTutor, registerParent).
// ---------------------------------------------------------------------
const TUTOR_COLS = 'id,name,subject,levels,qual,exp,area,price,phone,status,created_at';
const PARENT_COLS = 'phone,name,created_at';

// SAFETY NET: if any page still calls .select('*') or .select() (including
// .insert(...).select()) on tutors or parent_accounts, this automatically swaps
// the '*' for the safe column list, so the database never refuses the request.
// Pages that name their own columns are left untouched.
(function protectPasswordTables() {
  const SAFE = { tutors: TUTOR_COLS, parent_accounts: PARENT_COLS };
  const rawFrom = db.from.bind(db);
  function guard(builder, cols) {
    return new Proxy(builder, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target);
        if (prop === 'select') {
          return (c, opts) => guard(target.select(!c || String(c).trim() === '*' ? cols : c, opts), cols);
        }
        if (typeof v === 'function') {
          return (...args) => {
            const r = v.apply(target, args);
            return r === target || (r && typeof r === 'object' && typeof r.select === 'function') ? guard(r, cols) : r;
          };
        }
        return v;
      }
    });
  }
  db.from = (table) => (SAFE[table] ? guard(rawFrom(table), SAFE[table]) : rawFrom(table));
})();

const AVATAR_COLORS = ['#2C3E63', '#3F6B4E', '#D98E2B', '#A6432B'];
const KNOWN_AREAS = [
  'Anantpur', 'Chirahula Colony', 'Padra', 'Huzur', 'Saman', 'Chorhata',
  'Indira Nagar', 'Maidani', 'Sirmour Chowk', 'Civil Lines'
];

// ---------- small helpers ----------
function initials(name) {
  return (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function colorFor(id) {
  let h = 0;
  const str = String(id || '');
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// Today's date in the user's own time zone (the old version used UTC, which
// shows yesterday's date in India before 5:30 AM).
function todayStr() {
  return new Date().toLocaleDateString('en-CA');
}

function starString(n) {
  const full = Math.max(0, Math.min(5, Math.round(n || 0)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// Keeps the last 10 digits: "+91 98765 43210" -> "9876543210"
function normPhone(p) {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

function waLink(phone, name, context) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '#';
  const withCountry = digits.length === 10 ? '91' + digits : digits;
  const msg = encodeURIComponent(`Hello ${name}, this is regarding ${context} on Shiksha Kiran.`);
  return `https://wa.me/${withCountry}?text=${msg}`;
}

function dbError(error) {
  if (error && error.code === '23505') return new Error('This phone number is already registered.');
  if (error && error.code === '42501') return new Error('Permission denied. Please contact support.');
  return new Error((error && error.message) || 'Something went wrong. Please try again.');
}

// ---------- data mappers (database row -> object used by the pages) ----------
function mapTutor(r) {
  return { id: r.id, name: r.name, subject: r.subject, levels: r.levels, qual: r.qual, exp: r.exp, area: r.area, price: r.price, phone: r.phone, status: r.status, createdAt: new Date(r.created_at).getTime() };
}
function mapApplication(r) {
  return { id: r.id, tutorId: r.tutor_id, tutorName: r.tutor_name, parentName: r.parent_name, parentPhone: r.parent_phone, childName: r.child_name, createdAt: new Date(r.created_at).getTime() };
}
function mapRequirement(r) {
  return { id: r.id, name: r.name, phone: r.phone, subject: r.subject, levels: r.levels, area: r.area, budget: r.budget, notes: r.notes, handled: !!r.handled, createdAt: new Date(r.created_at).getTime() };
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

// ---------- safe database helpers (these never ask for the password column) ----------

// fetchTutors('approved') for the public list. Call with no argument for all.
async function fetchTutors(status) {
  let q = db.from('tutors').select(TUTOR_COLS).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return (data || []).map(mapTutor);
}

async function fetchParentAccounts() {
  const { data, error } = await db.from('parent_accounts').select(PARENT_COLS).order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return (data || []).map(mapParentAccount);
}

// Tutor registration. New tutors always start as "pending" until the admin approves them.
// The row is NOT read back (reading back would ask for the password column and fail).
// The database hashes the password automatically.
async function registerTutor(t) {
  const row = {
    id: (crypto.randomUUID ? crypto.randomUUID() : undefined),
    name: String(t.name || '').trim(),
    subject: String(t.subject || '').trim(),
    levels: String(t.levels || '').trim() || '—',
    qual: String(t.qual || '').trim() || '—',
    exp: String(t.exp || '').trim() || '—',
    area: String(t.area || '').trim(),
    price: String(t.price || '').trim(),
    phone: normPhone(t.phone),
    password: String(t.password || ''),
    status: 'pending'
  };
  if (!row.id) delete row.id;
  if (!row.name || !row.subject || !row.area || !row.price) throw new Error('Please fill in all required fields.');
  if (row.phone.length !== 10) throw new Error('Enter a valid 10-digit phone number.');
  if (row.password.length < 4) throw new Error('Password should be at least 4 characters.');

  const { data: existing, error: e1 } = await db.from('tutors').select('id').eq('phone', row.phone).limit(1);
  if (e1) throw dbError(e1);
  if (existing && existing.length) throw new Error('This phone number is already registered.');

  const { error } = await db.from('tutors').insert(row); // no .select() on purpose
  if (error) throw dbError(error);
  return { ok: true };
}

// Parent registration (phone number is the account id).
async function registerParent({ phone, name, password }) {
  const row = { phone: normPhone(phone), name: String(name || '').trim(), password: String(password || '') };
  if (!row.name) throw new Error('Please enter your name.');
  if (row.phone.length !== 10) throw new Error('Enter a valid 10-digit phone number.');
  if (row.password.length < 4) throw new Error('Password should be at least 4 characters.');
  const { error } = await db.from('parent_accounts').insert(row); // no .select() on purpose
  if (error) throw dbError(error);
  return { ok: true, name: row.name };
}

// ---------- server functions ----------
async function postJson(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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

// action: 'parent_login' or 'teacher_login'
async function callAuth(action, phone, password) {
  return postJson(AUTH_FN_URL, { action, phone: normPhone(phone), password });
}

// action: list_tutors, update_tutor_status, add_teacher_approved, delete_tutor,
// list_requirements, set_requirement_handled, delete_requirement,
// reset_tutor_password, reset_parent_password
async function callAdmin(adminPassword, action, payload) {
  return postJson(ADMIN_FN_URL, { password: adminPassword, action, payload });
}
