import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Initialize SQL client inside handler
  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'DATABASE_URL environment variable is not set' })
    };
  }
  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET: イベント取得
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id;
      const organizerToken = event.queryStringParameters?.organizer_token;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      }

      // イベント取得
      const events = await sql`
        SELECT * FROM events WHERE id = ${id}
      `;

      if (events.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Event not found' }) };
      }

      const evt = events[0];

      // トークン検証で主催者判定
      const isOrganizer = !!(organizerToken && evt.organizer_token && organizerToken === evt.organizer_token);

      // 回答取得
      const responses = await sql`
        SELECT * FROM responses WHERE event_id = ${id} ORDER BY created_at ASC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: evt.id,
          title: evt.title,
          description: evt.description,
          candidates: evt.candidates,
          fixed_candidate_id: evt.fixed_candidate_id,
          venue: evt.venue,
          is_organizer: isOrganizer,
          responses: responses.map(r => ({
            id: r.id,
            name: r.name,
            comment: r.comment,
            answers: r.answers
          }))
        })
      };
    }

    // POST: イベント作成
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { title, description, candidates, venue } = body;

      if (!title || !candidates || candidates.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'title and candidates required' }) };
      }

      if (title.length > 255) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'イベント名は255文字以内で入力してください' }) };
      }

      // ランダムID生成
      const id = generateId();
      // 主催者トークン生成
      const organizerToken = crypto.randomBytes(32).toString('hex');

      // JSONBカラム用にシリアライズ
      const candidatesJson = JSON.stringify(candidates);
      const venueJson = venue ? JSON.stringify(venue) : null;

      await sql`
        INSERT INTO events (id, title, description, candidates, venue, organizer_token, created_at)
        VALUES (${id}, ${title}, ${description || ''}, ${candidatesJson}::jsonb, ${venueJson}::jsonb, ${organizerToken}, NOW())
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id, organizer_token: organizerToken })
      };
    }

    // PATCH: イベント更新
    if (event.httpMethod === 'PATCH') {
      const { id, fixed_candidate_id, venue, organizer_token } = JSON.parse(event.body);

      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      }

      // 主催者トークン検証
      if (organizer_token) {
        const events = await sql`
          SELECT organizer_token FROM events WHERE id = ${id}
        `;
        if (events.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Event not found' }) };
        }
        if (events[0].organizer_token !== organizer_token) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
      }

      // 更新するフィールドを動的に構築
      if (fixed_candidate_id !== undefined) {
        await sql`
          UPDATE events SET fixed_candidate_id = ${fixed_candidate_id}, updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      if (venue !== undefined) {
        const venueJson = venue ? JSON.stringify(venue) : null;
        await sql`
          UPDATE events SET venue = ${venueJson}::jsonb, updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (error) {
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Database error',
        detail: String(error)
      })
    };
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
