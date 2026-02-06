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

  try {
    // GET: チャットメッセージ取得
    if (event.httpMethod === 'GET') {
      const event_id = event.queryStringParameters?.event_id;
      if (!event_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'event_id required' }) };
      }

      const messages = await sql`
        SELECT * FROM chat_messages WHERE event_id = ${event_id} ORDER BY created_at ASC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ messages: messages.map(m => ({
          id: m.id,
          user: m.user_name,
          message: m.message,
          isOrganizer: m.is_organizer,
          createdAt: m.created_at
        }))})
      };
    }

    // POST: チャットメッセージ送信
    if (event.httpMethod === 'POST') {
      const { event_id, user, message, isOrganizer } = JSON.parse(event.body);

      if (!event_id || !user || !message) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'event_id, user, and message required' }) };
      }

      if (message.length > 1000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'メッセージは1000文字以内で入力してください' }) };
      }

      const id = generateId();
      await sql`
        INSERT INTO chat_messages (id, event_id, user_name, message, is_organizer, created_at)
        VALUES (${id}, ${event_id}, ${user}, ${message}, ${!!isOrganizer}, NOW())
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
