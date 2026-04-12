
export default async function handler(req, res) {
  // Xử lý verification (challenge) của Zalo - cả GET và POST
  if (req.query && req.query.challenge) {
    return res.status(200).send(req.query.challenge);
  }
  if (req.body && req.body.challenge) {
    return res.status(200).send(req.body.challenge);
  }

  // Nếu là POST bình thường (event follow)
  if (req.method === 'POST') {
    try {
      const payload = req.body;
      if (payload.event === 'follow' && payload.user_id) {
        const userId = payload.user_id;
        console.log('✅ Follow event - UID:', userId);

        const userInfo = await getZaloUserInfo(userId);
        if (userInfo && userInfo.phone) {
          const phone = String(userInfo.phone).replace(/\D/g, '');
          console.log('📱 Phone:', phone);
          await updateGoogleSheet(phone, userId);
        }
      }
      return res.status(200).send('OK');
    } catch (error) {
      console.error(error);
      return res.status(500).send('Error');
    }
  }

  return res.status(200).send('OK');
}

// Các hàm còn lại giữ nguyên (getZaloUserInfo + updateGoogleSheet)
async function getZaloUserInfo(userId) {
  const url = `https://openapi.zalo.me/v2.0/oa/user/detail?user_id=${userId}`;
  const res = await fetch(url, { headers: { access_token: process.env.ZALO_ACCESS_TOKEN } });
  const json = await res.json();
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
    console.log(`✅ Cập nhật UID ${uid} cho số ${phone} tại dòng ${rowIndex + 1}`);
  } else {
    console.log(`⚠️ Không tìm thấy số ${phone}`);
  }
}
