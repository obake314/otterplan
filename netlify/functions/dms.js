import { neon } from '@neondatabase/serverless';

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  // テーブル自動作成
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id VARCHAR(32) PRIMARY KEY,
        event_id VARCHAR(32) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        from_name TEXT NOT NULL,
        to_name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_direct_messages_event_id ON direct_messages(event_id)`;
  } catch (e) {
    // テーブルが既に存在する場合は無視
  }

  try {
    // GET: DM取得
    if (event.httpMethod === 'GET') {
      const event_id = event.queryStringParameters?.event_id;
      if (!event_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'event_id required' }) };
      }

      const messages = await sql`
        SELECT * FROM direct_messages WHERE event_id = ${event_id} ORDER BY created_at ASC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ messages: messages.map(m => ({
          id: m.id,
          from: m.from_name,
          to: m.to_name,
          message: m.message,
          createdAt: m.created_at
        }))})
      };
    }

    // POST: DM送信
    if (event.httpMethod === 'POST') {
      const { event_id, from, to, message } = JSON.parse(event.body);

      if (!event_id || !from || !to || !message) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'event_id, from, to, and message required' }) };
      }

      if (message.length > 1000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'メッセージは1000文字以内で入力してください' }) };
      }

      const id = generateId();
      await sql`
        INSERT INTO direct_messages (id, event_id, from_name, to_name, message, created_at)
        VALUES (${id}, ${event_id}, ${from}, ${to}, ${message}, NOW())
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Database error', detail: String(error) })
    };
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
