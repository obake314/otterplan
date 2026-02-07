import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'DATABASE_URL environment variable is not set' })
    };
  }
  const sql = neon(process.env.DATABASE_URL);

  // organizer_tokenカラムの有無を確認・追加
  let hasTokenColumn = false;
  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'organizer_token'
    `;
    hasTokenColumn = cols.length > 0;
  } catch (e) {
    // information_schema読み取りに失敗した場合は無視
  }

  if (!hasTokenColumn) {
    try {
      await sql`ALTER TABLE events ADD COLUMN organizer_token VARCHAR(64) DEFAULT NULL`;
      hasTokenColumn = true;
    } catch (e) {
      // IF NOT EXISTS非対応の場合、既に存在するエラーも含めてリトライ
      // 既に存在する場合はcolumn already existsエラーなので hasTokenColumn = true
      if (String(e).includes('already exists')) {
        hasTokenColumn = true;
      }
    }
  }

  try {
    // GET: イベント取得
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id;
      const organizerToken = event.queryStringParameters?.organizer_token;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      }

      // 期限切れイベントのクリーンアップ（候補日の最終日時から48時間後）
      try {
        await sql`
          DELETE FROM events WHERE id IN (
            SELECT e.id FROM events e
            WHERE (
              SELECT MAX(c->>'datetime')
              FROM jsonb_array_elements(e.candidates) AS c
            ) < (NOW() - INTERVAL '48 hours')::text
          )
        `;
      } catch (e) {
        console.error('Cleanup error:', e);
      }

      const events = await sql`
        SELECT * FROM events WHERE id = ${id}
      `;

      if (events.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Event not found' }) };
      }

      const evt = events[0];

      // トークン検証で主催者判定
      const isOrganizer = hasTokenColumn && !!(organizerToken && evt.organizer_token && organizerToken === evt.organizer_token);

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

      const id = generateId();
      const organizerToken = crypto.randomBytes(32).toString('hex');
      const candidatesJson = JSON.stringify(candidates);
      const venueJson = venue ? JSON.stringify(venue) : null;

      if (hasTokenColumn) {
        await sql`
          INSERT INTO events (id, title, description, candidates, venue, organizer_token, created_at)
          VALUES (${id}, ${title}, ${description || ''}, ${candidatesJson}::jsonb, ${venueJson}::jsonb, ${organizerToken}, NOW())
        `;
      } else {
        await sql`
          INSERT INTO events (id, title, description, candidates, venue, created_at)
          VALUES (${id}, ${title}, ${description || ''}, ${candidatesJson}::jsonb, ${venueJson}::jsonb, NOW())
        `;
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id, organizer_token: hasTokenColumn ? organizerToken : null })
      };
    }

    // PATCH: イベント更新
    if (event.httpMethod === 'PATCH') {
      const { id, fixed_candidate_id, venue, organizer_token } = JSON.parse(event.body);

      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      }

      // 主催者トークン検証（カラムがある場合のみ）
      if (hasTokenColumn && organizer_token) {
        const events = await sql`
          SELECT organizer_token FROM events WHERE id = ${id}
        `;
        if (events.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Event not found' }) };
        }
        if (events[0].organizer_token && events[0].organizer_token !== organizer_token) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
      }

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

    // DELETE: イベント削除（主催者のみ）
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      const organizerToken = event.queryStringParameters?.organizer_token;

      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      }

      if (hasTokenColumn) {
        const events = await sql`
          SELECT organizer_token FROM events WHERE id = ${id}
        `;
        if (events.length === 0) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Event not found' }) };
        }
        if (!organizerToken || events[0].organizer_token !== organizerToken) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
      }

      await sql`DELETE FROM events WHERE id = ${id}`;

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
