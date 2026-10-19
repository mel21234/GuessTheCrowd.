/**
 * POST /api/admin — every admin operation, validated with Zod.
 * Requires `Authorization: Bearer <Supabase access token>`; the user id from
 * that token is re-checked against the admins table inside every SQL function.
 */
import { getDb } from '../db';
import { errorJson, handler, json, readBody } from '../http';
import { adminBody, type AdminBody } from '../schemas';

const KNOWN_ERRORS = new Set([
  'not_ready',
  'date_taken',
  'date_in_past',
  'locked',
  'has_votes',
  'not_found',
  'already_reviewed',
  'empty_question',
  'unknown_locale',
  'invalid_action',
]);

function toRpc(body: AdminBody, admin: string): [string, Record<string, unknown>] {
  switch (body.action) {
    case 'dashboard':
      return ['admin_dashboard', { p_admin: admin, p_from: body.from, p_days: body.days ?? 42 }];
    case 'questions':
      return ['admin_questions', { p_admin: admin, p_status: body.status ?? null, p_search: body.search ?? null }];
    case 'saveQuestion':
      return [
        'admin_save_question',
        { p_admin: admin, p_id: body.id ?? null, p_translations: body.translations, p_min_votes: body.minVotes ?? null },
      ];
    case 'schedule':
      return ['admin_schedule', { p_admin: admin, p_id: body.id, p_date: body.date }];
    case 'unschedule':
      return ['admin_unschedule', { p_admin: admin, p_id: body.id }];
    case 'void':
      return ['admin_void', { p_admin: admin, p_id: body.id }];
    case 'delete':
      return ['admin_delete', { p_admin: admin, p_id: body.id }];
    case 'stats':
      return ['admin_question_stats', { p_admin: admin, p_id: body.id }];
    case 'submissions':
      return ['admin_submissions', { p_admin: admin, p_status: body.status ?? 'pending' }];
    case 'reviewSubmission':
      return [
        'admin_review_submission',
        { p_admin: admin, p_id: body.id, p_action: body.decision, p_text: body.text ?? null },
      ];
  }
}

export const postAdmin = handler(async (req) => {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return errorJson('unauthorized', 401);

  const b = await readBody(req, adminBody);
  if (!b.ok) return b.res;

  const db = await getDb();
  const userId = await db.getUserId(token);
  if (!userId) return errorJson('unauthorized', 401);

  const [fn, args] = toRpc(b.data, userId);
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    const code = error.message.trim();
    if (code === 'forbidden') return errorJson('forbidden', 403);
    if (KNOWN_ERRORS.has(code)) return errorJson(code, 409);
    console.error(`${fn}: ${error.message}`);
    return errorJson('server_error', 500);
  }
  return json(data);
});
