import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // POST: 回答追加
    if (event.httpMethod === 'POST') {
      const { event_id, name, comment, answers } = JSON.parse(event.body);

      if (!event_id || !name || !answers) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'event_id, name, and answers required' }) 
        };
      }

      // イベントが存在するか確認
      const events = await sql`
        SELECT id FROM events WHERE id = ${event_id}
      `;

      if (events.length === 0) {
        return { 
          statusCode: 404, 
          headers, 
          body: JSON.stringify({ error: 'Event not found' }) 
        };
      }

      // 回答を追加
      const id = generateId();
      const answersJson = JSON.stringify(answers);
      
      await sql`
        INSERT INTO responses (id, event_id, name, comment, answers, created_at)
        VALUES (${id}, ${event_id}, ${name}, ${comment || ''}, ${answersJson}::jsonb, NOW())
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
