import { neon } from '@neondatabase/serverless';

let sqlClient; // ← グローバルに保持（関数のまま）

function getSql() {
  if (sql) return sql;
	const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is missing');

  sql = neon(url);
  return sql;
}
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

  try {
    // GET: イベント取得
    if (event.httpMethod === 'GET') {
      const id = event.queryStringParameters?.id;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      }

      // イベント取得
	const sql = getSql();
      const events = await sql`
        SELECT * FROM events WHERE id = ${id}
      `;
      
      if (events.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Event not found' }) };
      }

      const evt = events[0];

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

      // ランダムID生成
      const id = generateId();
      
      // JSONBカラム用にシリアライズ
      const candidatesJson = JSON.stringify(candidates);
      const venueJson = venue ? JSON.stringify(venue) : null;

      await sql`
        INSERT INTO events (id, title, description, candidates, venue, created_at)
        VALUES (${id}, ${title}, ${description || ''}, ${candidatesJson}::jsonb, ${venueJson}::jsonb, NOW())
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id })
      };
    }

    // PATCH: イベント更新
    if (event.httpMethod === 'PATCH') {
      const { id, fixed_candidate_id, venue } = JSON.parse(event.body);

      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
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
