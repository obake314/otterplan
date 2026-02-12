import { neon } from '@neondatabase/serverless';

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
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

      if (name.length > 100) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '名前は100文字以内で入力してください' })
        };
      }

      // イベントが存在するか確認
      const events = await sql`
        SELECT id, fixed_candidate_id FROM events WHERE id = ${event_id}
      `;

      if (events.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Event not found' })
        };
      }

      // 日時確定済みの場合、新規回答を拒否
      if (events[0].fixed_candidate_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '日時が確定済みのため、新規回答は受け付けていません' })
        };
      }

      // 回答数上限チェック（最大10人）
      const countResult = await sql`
        SELECT COUNT(*)::int AS cnt FROM responses WHERE event_id = ${event_id}
      `;
      if (countResult[0].cnt >= 10) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '回答者数が上限（10人）に達しています' })
        };
      }

      // 回答を追加
      const id = generateId();
      const answersJson = JSON.stringify(answers);

      await sql`
        INSERT INTO responses (id, event_id, name, comment, answers, created_at)
        VALUES (${id}, ${event_id}, ${name}, ${comment || ''}, ${answersJson}::jsonb, NOW())
      `;

      // 回答数通知チェック
      try {
        const evtFull = await sql`
          SELECT title, notification_email, notification_threshold, notification_sent
          FROM events WHERE id = ${event_id}
        `;
        const evt = evtFull[0];
        if (evt && evt.notification_email && evt.notification_threshold && !evt.notification_sent) {
          const countResult = await sql`
            SELECT COUNT(*)::int AS cnt FROM responses WHERE event_id = ${event_id}
          `;
          const responseCount = countResult[0].cnt;
          if (responseCount >= evt.notification_threshold) {
            // 通知済みフラグを立てる
            await sql`UPDATE events SET notification_sent = TRUE WHERE id = ${event_id}`;
            // メール送信
            await sendNotificationEmail(
              evt.notification_email,
              evt.title,
              responseCount,
              evt.notification_threshold,
              event_id
            );
          }
        }
      } catch (e) {
        console.error('Notification check error:', e);
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id })
      };
    }

    // PUT: 回答編集
    if (event.httpMethod === 'PUT') {
      const { id, name, comment, answers } = JSON.parse(event.body);

      if (!id || !name || !answers) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'id, name, and answers required' })
        };
      }

      if (name.length > 100) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '名前は100文字以内で入力してください' })
        };
      }

      // 回答が存在するか確認
      const existing = await sql`
        SELECT id FROM responses WHERE id = ${id}
      `;

      if (existing.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Response not found' })
        };
      }

      const answersJson = JSON.stringify(answers);

      await sql`
        UPDATE responses SET name = ${name}, comment = ${comment || ''}, answers = ${answersJson}::jsonb
        WHERE id = ${id}
      `;

      return {
        statusCode: 200,
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

async function sendNotificationEmail(to, eventTitle, responseCount, threshold, eventId) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('RESEND_API_KEY not set, skipping email notification');
    return;
  }

  const fromAddress = process.env.NOTIFICATION_FROM || 'Otterplan <onboarding@resend.dev>';
  const siteUrl = process.env.URL || 'https://otterplan.netlify.app';
  const eventUrl = `${siteUrl}?id=${eventId}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #333;">回答が ${threshold}件 に達しました</h2>
      <p>イベント「<strong>${eventTitle}</strong>」の回答数が <strong>${responseCount}件</strong> になりました。</p>
      <p><a href="${eventUrl}" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 4px;">イベントを確認する</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">この通知は Otterplan から自動送信されました。</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: `【Otterplan】「${eventTitle}」の回答が${threshold}件に達しました`,
        html
      })
    });
    if (!res.ok) {
      console.error('Resend API error:', await res.text());
    }
  } catch (e) {
    console.error('Email send error:', e);
  }
}
