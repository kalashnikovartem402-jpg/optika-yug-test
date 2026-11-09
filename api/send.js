module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = Object.fromEntries(new URLSearchParams(body));
      }
    }

    if (body.antispam || body.website_hp) {
      return res.status(200).json({ status: 'success', message: 'Заявка принята' });
    }

    const clean = (value, max) => {
      if (typeof value !== 'string' && typeof value !== 'number') return '';
      return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>&"'`*_\[\]]/g, '').trim().slice(0, max);
    };
    const pick = (...values) => values.find((v) => typeof v === 'string' || typeof v === 'number');

    const name = clean(pick(body.name, body['field_name'] && body['field_name'][0] && body['field_name'][0].value), 100) || '—';
    const phone = clean(pick(body.phone, body['field_contact'] && body['field_contact'][0] && body['field_contact'][0].value, body['field_phone'] && body['field_phone'][0] && body['field_phone'][0].value), 30).replace(/[^0-9+()\- ]/g, '');
    const details = clean(pick(body.details, body.message, body['field_details'] && body['field_details'][0] && body['field_details'][0].value), 1000) || '—';
    const formTitle = body.form_id === 'contact_message_callback_form' ? 'Заказ обратного звонка' : 'Заявка с сайта';

    const digitsCount = (phone.match(/\d/g) || []).length;
    if (digitsCount < 10 || digitsCount > 15) {
      return res.status(400).json({ status: 'error', message: 'Пожалуйста, укажите корректный номер телефона.' });
    }

    const dateTime = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const clientIp = clean(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '—').split(',')[0], 45);

    console.log(`[Lead] ${dateTime} | ${formTitle} | ${name} | ${phone} | ${details}`);

    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      try {
        const text = `*${formTitle}*\n\n` +
          `*Имя:* ${name}\n` +
          `*Телефон:* ${phone}\n` +
          `*Сообщение:* ${details}\n` +
          `*Дата:* ${dateTime}`;

        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChatId, text: text, parse_mode: 'Markdown' })
        });
      } catch (e) {
        console.error('Telegram send error:', e);
      }
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Оптика Юг <onboarding@resend.dev>',
            to: ['Opticasouth@yandex.ru'],
            subject: `${formTitle} [${phone}]`,
            html: `<p><b>Имя:</b> ${name}</p><p><b>Телефон:</b> ${phone}</p><p><b>Сообщение:</b> ${details}</p><p><small>${dateTime} | ${clientIp}</small></p>`
          })
        });
      } catch (e) {
        console.error('Resend error:', e);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Спасибо! Ваша заявка успешно отправлена.'
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};
