// js/supabase-client.js
// Wrapper leve para o Supabase REST API (sem dependência de npm)

const SupabaseClient = (() => {
  let _url = 'https://dtnwwufpbfboszyvykyc.supabase.co';
  let _key = 'sb_publishable_TNYh4NBole7hTCTECSLTNg_fQ327qjY';

  function init(url, key) {
    _url = url.replace(/\/$/, '');
    _key = key;
  }

  function headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'apikey': _key,
      'Authorization': 'Bearer ' + _key,
      'Prefer': 'return=representation',
      ...extra
    };
  }

  function isReady() {
    return _url && _key;
  }

  // ── REST helpers ──────────────────────────────────────────
  async function get(table, params = '') {
    const r = await fetch(`${_url}/rest/v1/${table}?${params}`, {
      headers: headers()
    });
    if (!r.ok) throw new Error((await r.json()).message || r.statusText);
    return r.json();
  }

  async function post(table, body) {
    const r = await fetch(`${_url}/rest/v1/${table}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || err.details || r.statusText);
    }
    return r.json();
  }

  async function patch(table, id, body) {
    const r = await fetch(`${_url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || r.statusText);
    }
    return r.json();
  }

  async function del(table, id) {
    const r = await fetch(`${_url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    if (!r.ok) throw new Error(r.statusText);
    return true;
  }

  // ── Storage ───────────────────────────────────────────────
  async function uploadFile(bucket, path, blob, contentType) {
    const r = await fetch(`${_url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        'apikey': _key,
        'Authorization': 'Bearer ' + _key,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: blob
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || err.error || r.statusText);
    }
    const publicUrl = `${_url}/storage/v1/object/public/${bucket}/${path}`;
    return publicUrl;
  }

  async function deleteFile(bucket, path) {
    const r = await fetch(`${_url}/storage/v1/object/${bucket}/${path}`, {
      method: 'DELETE',
      headers: { 'apikey': _key, 'Authorization': 'Bearer ' + _key }
    });
    return r.ok;
  }

  // ── RPC (funções do postgres) ─────────────────────────────
  async function rpc(fn, body = {}) {
    const r = await fetch(`${_url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
    return r.json();
  }

  return { init, isReady, get, post, patch, del, uploadFile, deleteFile, rpc };
})();
