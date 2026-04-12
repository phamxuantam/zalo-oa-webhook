export default async function handler(req, res) {
  console.log('=== NHẬN REQUEST TỪ ZALO ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Xử lý challenge (Zalo verify)
  if (req.query?.challenge) {
    console.log('✅ Xử lý challenge GET');
    return res.status(200).send(req.query.challenge);
  }
  if (req.body?.challenge) {
    console.log('✅ Xử lý challenge POST');
    return res.status(200).send(req.body.challenge);
  }

  // Xử lý event follow MỚI của Zalo
  if (req.method === 'POST' && req.body?.event_name === 'follow' && req.body?.follower?.id) {
    const userId = req.body.follower.id;
    console.log('✅ Follow event - UID:', userId);

    const userInfo = await getZaloUserInfo(userId);
    if (userInfo && userInfo.phone) {
      const phone = String(userInfo.phone).replace(/\D/g, '');
      console.log('📱 Phone từ Zalo:', phone);
      await updateGoogleSheet(phone, userId);
    } else {
      console.log('⚠️ Không lấy được phone từ userInfo');
    }
  } else {
    console.log('ℹ️ Không phải event follow hoặc payload không đúng');
  }

  return res.status(200).send('OK');
}

async function getZaloUserInfo(userId) {
  const url = `https://openapi.zalo.me/v2.0/oa/user/detail?user_id=${userId}`;
  const res = await fetch(url, { headers: { access_token: process.env.ZALO_ACCESS_TOKEN } });
  const json = await res.json();
  console.log('UserInfo từ Zalo:', JSON.stringify(json, null, 2));
  return json.error === 0 ? json.data : null;
}

async function updateGoogleSheet(phone, uid) {
  const { google } = await import('@googleapis/sheets');
  const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');

  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = `DSHS!E1:F2000`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: '1B1ImOi9U7iDtvGfr0rrRE6HA2J9XKpFUQH459tv0xxg',
    range,
  });

  const rows = response.data.values || [];
  let rowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const cellPhone = String(rows[i][0] || '').replace(/\D/g, '');
    if (cellPhone === phone) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex !== -1) {
    const updateRange = `DSHS!F${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: '1B1ImOi9U7iDtvGfr0rrRE6HA2J9XKpFUQH459tv0xxg',
      range: updateRange,
      valueInputOption: 'RAW',
      resource: { values: [[uid]] },
    });
    console.log(`✅ ĐÃ CẬP NHẬT UID ${uid} cho số ${phone} tại dòng ${rowIndex + 1}`);
  } else {
    console.log(`⚠️ Không tìm thấy số điện thoại ${phone} trong Sheet`);
  }
}
