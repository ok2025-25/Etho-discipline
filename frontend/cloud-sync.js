/* ============================================================
   ETHO — Cloud sync helper
   ------------------------------------------------------------
   Drop-in async replacement for localStorage.getItem/setItem,
   backed by the "user_data" table (user_id, key, value jsonb).
   This is what makes data follow the ACCOUNT instead of the
   device/browser — for a signed-in user. For a guest (no user),
   every function below just reads/writes plain localStorage and
   never touches the network — that's the entire guest-mode data
   layer, no separate code path needed.

   Include AFTER auth.js (needs supabaseClient) and BEFORE any
   page script that calls cloudGet/cloudSet (checklist.js,
   goals.js, tracker.js, learning.js).

   localStorage is kept as a fast local cache:
   - cloudGet() returns the cloud copy when reachable, and also
     refreshes the local cache so the app still works offline.
   - cloudSet() writes to both, immediately.

   The local cache is namespaced per user id (see _localKey below)
   for a signed-in user; a guest's data is stored under the plain,
   unscoped key. Without the per-account scoping, two different
   accounts signing in on the same browser/device would read and
   even overwrite each other's data through the shared unscoped
   key — a real cross-account leak, not just a cosmetic bug.
   signOutUser() (auth.js) also clears localStorage entirely on
   sign-out, so nothing lingers for the next person on a shared
   device even before this scoping existed — that also means a
   freshly-signed-out user starts a new guest session with no
   local data, which is expected.
   ============================================================ */

async function _currentUserOrNull() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user || null;
  } catch (_) {
    return null;
  }
}

function _localKey(key, user) {
  return user ? `u_${user.id}::${key}` : key;
}

async function cloudGet(key, fallback) {
  const user = await _currentUserOrNull();
  const localKey = _localKey(key, user);
  const cached = localStorage.getItem(localKey);
  const localValue = cached ? JSON.parse(cached) : fallback;

  if (!user) return localValue; // guest — local-only, no cloud row to check

  try {
    const { data, error } = await supabaseClient
      .from("user_data")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      localStorage.setItem(localKey, JSON.stringify(data.value));
      return data.value;
    }

    // First time this account has touched this key on any device —
    // seed the cloud row so future reads/writes have something to sync.
    await cloudSet(key, localValue);
    return localValue;
  } catch (err) {
    console.warn(`cloudGet("${key}") failed, falling back to local cache`, err);
    return localValue;
  }
}

async function cloudSet(key, value) {
  const user = await _currentUserOrNull();
  localStorage.setItem(_localKey(key, user), JSON.stringify(value));

  if (!user) return false; // guest — saved locally only, no account to sync to

  try {
    const { error } = await supabaseClient
      .from("user_data")
      .upsert(
        { user_id: user.id, key, value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn(`cloudSet("${key}") failed, saved locally only — will retry next save`, err);
    return false;
  }
}

async function cloudDelete(key) {
  const user = await _currentUserOrNull();
  localStorage.removeItem(_localKey(key, user));

  if (!user) return;

  try {
    const { error } = await supabaseClient
      .from("user_data")
      .delete()
      .eq("user_id", user.id)
      .eq("key", key);
    if (error) throw error;
  } catch (err) {
    console.warn(`cloudDelete("${key}") failed`, err);
  }
}
